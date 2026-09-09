import Coupon from "../../models/coupon.js";

// List all coupons with pagination and search
export const loadCouponsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const query = {};
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { discountType: { $regex: search, $options: "i" } }
      ];
    }

    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / limit) || 1;

    const coupons = await Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

    res.render("admin/coupons", {
      coupons,
      currentPage: page,
      totalPages,
      totalCoupons,
      search
    });
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

    const numericDiscount = parseFloat(discountValue);
    const numericMinPurchase = parseFloat(minPurchase) || 0;

    if (isNaN(numericDiscount) || numericDiscount <= 0) {
      return res.status(400).json({ success: false, message: "Discount value must be greater than zero." });
    }

    if (discountType === "percentage" && numericDiscount > 100) {
      return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%." });
    }

    if (numericDiscount >= numericMinPurchase) {
      return res.status(400).json({ success: false, message: "Discount value should be lower than min purchase price." });
    }
    

    // Date Validation
    const parsedExpDate = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(parsedExpDate.getTime())) {
      return res.status(400).json({ success: false, message: "Please enter a valid expiry date." });
    }

    if (parsedExpDate < today) {
      return res.status(400).json({ success: false, message: "Coupon expiry date cannot be in the past." });
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
      expiryDate: parsedExpDate,
      usageLimit: usageLimit ? parseInt(usageLimit) : null
    });

    res.status(200).json({ success: true, message: "Coupon created successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to create coupon." });
  }
};

// Update existing Coupon with validation
export const updateCoupon = async (req, res) => {
  try {
    const { couponId, code, discountType, discountValue, minPurchase, maxDiscount, expiryDate, usageLimit } = req.body;

    if (!couponId || !code || !discountType || !discountValue || !expiryDate) {
      return res.status(400).json({ success: false, message: "Please fill all required fields." });
    }

    const numericDiscount = parseFloat(discountValue);
    const numericMinPurchase = parseFloat(minPurchase) || 0;

    if (isNaN(numericDiscount) || numericDiscount <= 0) {
      return res.status(400).json({ success: false, message: "Discount value must be greater than zero." });
    }

    if (discountType === "percentage" && numericDiscount > 100) {
      return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%." });
    }

    if (numericDiscount >= numericMinPurchase) {
      return res.status(400).json({ success: false, message: "Discount value should be lower than min purchase price." });
    }

    // Date Validation
    const parsedExpDate = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(parsedExpDate.getTime())) {
      return res.status(400).json({ success: false, message: "Please enter a valid expiry date." });
    }

    if (parsedExpDate < today) {
      return res.status(400).json({ success: false, message: "Coupon expiry date cannot be in the past." });
    }

    // Check duplicate code (excluding self)
    const existing = await Coupon.findOne({ code: code.toUpperCase(), _id: { $ne: couponId } });
    if (existing) {
      return res.status(400).json({ success: false, message: "Coupon code already in use by another coupon." });
    }

    await Coupon.findByIdAndUpdate(couponId, {
      code: code.toUpperCase(),
      discountType,
      discountValue: parseFloat(discountValue),
      minPurchase: parseFloat(minPurchase) || 0,
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
      expiryDate: parsedExpDate,
      usageLimit: usageLimit ? parseInt(usageLimit) : null
    });

    res.status(200).json({ success: true, message: "Coupon updated successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update coupon." });
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
