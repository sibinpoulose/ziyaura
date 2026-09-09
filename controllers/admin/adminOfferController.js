import Offer from "../../models/offer.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";

// Load offers management page
export const loadOffersPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { targetType: { $regex: search, $options: "i" } },
        { discountType: { $regex: search, $options: "i" } }
      ];
    }

    const totalOffers = await Offer.countDocuments(query);
    const totalPages = Math.ceil(totalOffers / limit) || 1;

    const offers = await Offer.find(query)
      .populate("productTarget", "name")
      .populate("categoryTarget", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    const products = await Product.find({ isDeleted: false });
    const categories = await Category.find({ isListed: true });
    
    res.render("admin/offers", {
      offers,
      products,
      categories,
      currentPage: page,
      totalPages,
      totalOffers,
      search
    });
  } catch (error) {
    console.error(error);
    req.session.error = "Unable to load offers management page.";
    res.redirect("/admin/dashboard");
  }
};

// Helper utility to evaluate Product offers vs Category offers and calculate the best price
export const recalculatePrices = async () => {
  const products = await Product.find({ isDeleted: false });
  const activeOffers = await Offer.find({ isActive: true, expiryDate: { $gt: new Date() } });

  for (let product of products) {
    // Find Product Offers
    const prodOffer = activeOffers.find(o => o.targetType === "product" && o.productTarget?.toString() === product._id.toString());
    // Find Category Offers
    const catOffer = activeOffers.find(o => o.targetType === "category" && o.categoryTarget?.toString() === product.category.toString());

    let bestProductDiscount = 0;
    if (prodOffer) {
      bestProductDiscount = prodOffer.discountType === "percentage" 
        ? (product.price * prodOffer.discountValue) / 100 
        : prodOffer.discountValue;
    }

    let bestCategoryDiscount = 0;
    if (catOffer) {
      bestCategoryDiscount = catOffer.discountType === "percentage" 
        ? (product.price * catOffer.discountValue) / 100 
        : catOffer.discountValue;
    }

    // Apply the LARGER discount amount
    const finalDiscount = Math.max(bestProductDiscount, bestCategoryDiscount);

    if (product.variants && product.variants.length > 0) {
      // Recalculate variant prices
      product.variants.forEach(variant => {
        let vProdDiscount = prodOffer ? (prodOffer.discountType === "percentage" ? (variant.price * prodOffer.discountValue) / 100 : prodOffer.discountValue) : 0;
        let vCatDiscount = catOffer ? (catOffer.discountType === "percentage" ? (variant.price * catOffer.discountValue) / 100 : catOffer.discountValue) : 0;
        let vFinalDiscount = Math.max(vProdDiscount, vCatDiscount);
        variant.salePrice = vFinalDiscount > 0 ? Math.max(0, variant.price - vFinalDiscount) : null;
      });
    } else {
      product.salePrice = finalDiscount > 0 ? Math.max(0, product.price - finalDiscount) : null;
    }

    await product.save();
  }
};

// Create a new offer
export const createOffer = async (req, res) => {
  try {
    const { name, discountType, discountValue, targetType, productTarget, categoryTarget, expiryDate } = req.body;

    if (!name || !discountType || !discountValue || !targetType || !expiryDate) {
      return res.status(400).json({ success: false, message: "Please fill all required fields." });
    }

    const numericDiscount = parseFloat(discountValue);
    if (isNaN(numericDiscount) || numericDiscount <= 0) {
      return res.status(400).json({ success: false, message: "Discount value must be greater than zero." });
    }

    if (discountType === "percentage" && numericDiscount > 100) {
      return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%." });
    }

    // Date Validation
    const parsedExpDate = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(parsedExpDate.getTime())) {
      return res.status(400).json({ success: false, message: "Please enter a valid expiry date." });
    }

    if (parsedExpDate < today) {
      return res.status(400).json({ success: false, message: "Offer campaign expiry date cannot be in the past." });
    }

    const offerData = {
      name,
      discountType,
      discountValue: numericDiscount,
      targetType,
      expiryDate: parsedExpDate
    };

    if (targetType === "product") offerData.productTarget = productTarget;
    if (targetType === "category") offerData.categoryTarget = categoryTarget;

    await Offer.create(offerData);
    
    // Apply discount rates globally across targeted items
    await recalculatePrices();

    res.status(200).json({ success: true, message: "Offer created successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to create offer." });
  }
};

// Delete Offer
export const deleteOffer = async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    await recalculatePrices(); // Reset prices back to normal
    res.status(200).json({ success: true, message: "Offer deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete offer." });
  }
};
