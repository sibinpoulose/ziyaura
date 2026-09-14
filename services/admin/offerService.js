import Offer from "../../models/offer.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";

export const recalculatePrices = async () => {
  const products = await Product.find({ isDeleted: false });
  const activeOffers = await Offer.find({ isActive: true, expiryDate: { $gt: new Date() } });

  for (const product of products) {
    const prodOffer = activeOffers.find(
      (o) => o.targetType === "product" && o.productTarget?.toString() === product._id.toString()
    );
    const catOffer = activeOffers.find(
      (o) => o.targetType === "category" && o.categoryTarget?.toString() === product.category.toString()
    );

    let bestProductDiscount = 0;
    if (prodOffer) {
      bestProductDiscount =
        prodOffer.discountType === "percentage"
          ? (product.price * prodOffer.discountValue) / 100
          : prodOffer.discountValue;
    }

    let bestCategoryDiscount = 0;
    if (catOffer) {
      bestCategoryDiscount =
        catOffer.discountType === "percentage"
          ? (product.price * catOffer.discountValue) / 100
          : catOffer.discountValue;
    }

    const finalDiscount = Math.max(bestProductDiscount, bestCategoryDiscount);

    if (product.variants && product.variants.length > 0) {
      product.variants.forEach((variant) => {
        const vProdDiscount = prodOffer
          ? prodOffer.discountType === "percentage"
            ? (variant.price * prodOffer.discountValue) / 100
            : prodOffer.discountValue
          : 0;
        const vCatDiscount = catOffer
          ? catOffer.discountType === "percentage"
            ? (variant.price * catOffer.discountValue) / 100
            : catOffer.discountValue
          : 0;
        const vFinalDiscount = Math.max(vProdDiscount, vCatDiscount);
        variant.salePrice = vFinalDiscount > 0 ? Math.max(0, variant.price - vFinalDiscount) : null;
      });
    } else {
      product.salePrice = finalDiscount > 0 ? Math.max(0, product.price - finalDiscount) : null;
    }

    await product.save();
  }
};

export const getOffersPageData = async ({ page = 1, limit = 5, search = "" }) => {
  const skip = (page - 1) * limit;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { targetType: { $regex: search, $options: "i" } },
      { discountType: { $regex: search, $options: "i" } }
    ];
  }

  const [totalOffers, offers, products, categories] = await Promise.all([
    Offer.countDocuments(query),
    Offer.find(query)
      .populate("productTarget", "name")
      .populate("categoryTarget", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.find({ isDeleted: false }).select("name price").lean(),
    Category.find({ isListed: true }).select("name").lean()
  ]);

  const totalPages = Math.ceil(totalOffers / limit) || 1;

  return {
    offers,
    products,
    categories,
    currentPage: page,
    totalPages,
    totalOffers,
    search
  };
};

export const validateOfferInput = ({ name, discountType, discountValue, targetType, expiryDate }) => {
  if (!name || !discountType || !discountValue || !targetType || !expiryDate) {
    return "Please fill all required fields.";
  }

  const numericDiscount = parseFloat(discountValue);
  if (isNaN(numericDiscount) || numericDiscount <= 0) {
    return "Discount value must be greater than zero.";
  }

  if (discountType === "percentage" && numericDiscount > 100) {
    return "Percentage discount cannot exceed 100%.";
  }

  const parsedExpDate = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(parsedExpDate.getTime())) {
    return "Please enter a valid expiry date.";
  }

  if (parsedExpDate < today) {
    return "Offer campaign expiry date cannot be in the past.";
  }

  return null;
};

export const createOfferService = async (data) => {
  const offerData = {
    name: data.name,
    discountType: data.discountType,
    discountValue: parseFloat(data.discountValue),
    targetType: data.targetType,
    expiryDate: new Date(data.expiryDate)
  };

  if (data.targetType === "product") offerData.productTarget = data.productTarget;
  if (data.targetType === "category") offerData.categoryTarget = data.categoryTarget;

  const offer = await Offer.create(offerData);
  await recalculatePrices();
  return offer;
};

export const deleteOfferService = async (offerId) => {
  const result = await Offer.findByIdAndDelete(offerId);
  await recalculatePrices();
  return result;
};
