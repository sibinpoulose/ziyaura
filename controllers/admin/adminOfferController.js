import Offer from "../../models/offer.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";

// Load offers management page
export const loadOffersPage = async (req, res) => {
  try {
    const offers = await Offer.find()
      .populate("productTarget", "name")
      .populate("categoryTarget", "name");
      
    const products = await Product.find({ isDeleted: false });
    const categories = await Category.find({ isListed: true });
    
    res.render("admin/offers", { offers, products, categories });
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

    const offerData = {
      name,
      discountType,
      discountValue: parseFloat(discountValue),
      targetType,
      expiryDate: new Date(expiryDate)
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
