import Coupon from "../../models/coupon.js";
import Cart from "../../models/Cart.js";

// Validate and Apply Coupon to Cart in Session
export const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    if (!couponCode) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    if (!coupon) {
      return res.status(400).json({ success: false, message: "Invalid coupon code." });
    }

    if (new Date() > coupon.expiryDate) {
      return res.status(400).json({ success: false, message: "Coupon code has expired." });
    }

    // Check if user already used this coupon
    const hasUsed = coupon.usersUsed.includes(req.user._id);
    if (hasUsed) {
      return res.status(400).json({ success: false, message: "You have already used this coupon code." });
    }

    // Check purchase criteria
    const cart = await Cart.findOne({ userId: req.user._id }).populate("items.productId");
    let subtotal = 0;
    if (cart) {
      for (const item of cart.items) {
        if (!item.productId || item.productId.isDeleted) continue;
        let price = item.productId.salePrice ?? item.productId.price;
        if (item.variantId) {
          const variant = item.productId.variants.id(item.variantId);
          if (variant) price = variant.salePrice ?? variant.price;
        }
        subtotal += price * item.quantity;
      }
    }

    if (subtotal < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Min. purchase of ₹${coupon.minPurchase} required to apply this coupon.`
      });
    }

    // Save coupon in user's session
    req.session.couponCode = coupon.code;
    return res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" applied successfully!`,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to apply coupon." });
  }
};

// Remove coupon code
export const removeCoupon = async (req, res) => {
  try {
    delete req.session.couponCode;
    return res.status(200).json({ success: true, message: "Coupon removed." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to remove coupon." });
  }
};
