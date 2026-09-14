import Coupon from "../../models/coupon.js";
import Cart from "../../models/Cart.js";

export const validateAndCalculateCoupon = async ({ userId, couponCode }) => {
  if (!couponCode) {
    return { error: "Coupon code is required" };
  }

  const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
  if (!coupon) {
    return { error: "Invalid coupon code." };
  }

  if (new Date() > coupon.expiryDate) {
    return { error: "Coupon code has expired." };
  }

  const hasUsed = coupon.usersUsed.includes(userId);
  if (hasUsed) {
    return { error: "You have already used this coupon code." };
  }

  const cart = await Cart.findOne({ userId }).populate("items.productId");
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
    return {
      error: `Min. purchase of ₹${coupon.minPurchase} required to apply this coupon.`
    };
  }

  return {
    success: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount
    }
  };
};
