import Coupon from "../../models/coupon.js";

// List all coupons
export const loadCouponsPage = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.render("admin/coupons", { coupons });
  } catch (error) {
    console.error(error);
    req.session.error = "Failed to load coupons.";
    res.redirect("/admin/dashboard");
  }
};

// Create Coupon with validation
export const createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, minPurchase, maxDiscount, expiryDate, usageLimit } = req.body;
    
    // Validations
    if (!code || !discountType || !discountValue || !expiryDate) {
      return res.status(400).json({ success: false, message: "Please fill all required fields." });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Coupon code already exists." });
    }

    await Coupon.create({
      code: code.toUpperCase(),
      discountType,
      discountValue: parseFloat(discountValue),
      minPurchase: parseFloat(minPurchase) || 0,
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
      expiryDate: new Date(expiryDate),
      usageLimit: usageLimit ? parseInt(usageLimit) : null
    });

    res.status(200).json({ success: true, message: "Coupon created successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to create coupon." });
  }
};

// Delete Coupon
export const deleteCoupon = async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Coupon deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete coupon." });
  }
};
