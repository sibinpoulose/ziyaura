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

export const validateOfferInput = ({
  name,
  discountType,
  discountValue,
  targetType,
  productTarget,
  categoryTarget,
  expiryDate
}) => {
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

  if (targetType === "product" && !productTarget) {
    return "Please select a target product.";
  }

  if (targetType === "category" && !categoryTarget) {
    return "Please select a target category.";
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

export const checkDuplicateOfferName = async (name, excludeId = null) => {
  const query = {
    name: { $regex: `^${name.trim()}$`, $options: "i" }
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return await Offer.findOne(query);
};

export const createOfferService = async (data) => {
  const existing = await checkDuplicateOfferName(data.name);
  if (existing) {
    return { error: "An offer campaign with this name already exists." };
  }

  const offerData = {
    name: data.name.trim(),
    discountType: data.discountType,
    discountValue: parseFloat(data.discountValue),
    targetType: data.targetType,
    expiryDate: new Date(data.expiryDate),
    productTarget: data.targetType === "product" ? data.productTarget : null,
    categoryTarget: data.targetType === "category" ? data.categoryTarget : null
  };

  const offer = await Offer.create(offerData);
  await recalculatePrices();
  return { success: true, offer };
};

export const updateOfferService = async (offerId, data) => {
  const offer = await Offer.findById(offerId);
  if (!offer) {
    return { error: "Offer campaign not found.", notFound: true };
  }

  const duplicate = await checkDuplicateOfferName(data.name, offerId);
  if (duplicate) {
    return { error: "An offer campaign with this name already exists." };
  }

  offer.name = data.name.trim();
  offer.discountType = data.discountType;
  offer.discountValue = parseFloat(data.discountValue);
  offer.targetType = data.targetType;
  offer.productTarget = data.targetType === "product" ? data.productTarget : null;
  offer.categoryTarget = data.targetType === "category" ? data.categoryTarget : null;
  offer.expiryDate = new Date(data.expiryDate);

  await offer.save();
  await recalculatePrices();

  return { success: true, offer };
};

export const deleteOfferService = async (offerId) => {
  const result = await Offer.findByIdAndDelete(offerId);
  await recalculatePrices();
  return result;
};
