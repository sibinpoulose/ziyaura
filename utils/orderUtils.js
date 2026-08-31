import Coupon from "../models/coupon.js";

/**
 * Recalculates order financials (subtotal, coupon discount, shipping, grandTotal, refundAmount)
 * when item(s) are cancelled or returned.
 *
 * Coupon Rule:
 * If the remaining subtotal of active items falls below the coupon's minPurchase,
 * the coupon discount is revoked (discount = 0).
 * Otherwise, the coupon discount is recalculated based on the remaining subtotal.
 */
export const recalculateOrderFinancials = async (order) => {
  const activeItems = order.products.filter(p => !["Cancelled", "Returned"].includes(p.orderStatus));
  const previousGrandTotal = order.grandTotal;

  if (activeItems.length === 0) {
    order.subtotal = 0;
    order.discount = 0;
    order.couponDiscount = 0;
    order.shippingCharge = 0;
    order.grandTotal = 0;
    order.orderStatus = order.products.some(p => p.orderStatus === "Returned") ? "Returned" : "Cancelled";
    
    // If order was paid, refund whatever grandTotal was remaining
    const refundAmount = (order.paymentStatus === "Paid" || order.paymentStatus === "Refunded") ? previousGrandTotal : 0;
    return refundAmount;
  }

  const newSubtotal = activeItems.reduce((sum, item) => sum + item.total, 0);
  let newDiscount = 0;

  if (order.couponCode) {
    const coupon = await Coupon.findOne({ code: order.couponCode.toUpperCase() });
    if (coupon) {
      if (newSubtotal >= (coupon.minPurchase || 0)) {
        if (coupon.discountType === "percentage") {
          newDiscount = (newSubtotal * coupon.discountValue) / 100;
          if (coupon.maxDiscount && newDiscount > coupon.maxDiscount) {
            newDiscount = coupon.maxDiscount;
          }
        } else {
          newDiscount = Math.min(coupon.discountValue, newSubtotal);
        }
      } else {
        // Subtotal drops below coupon minPurchase -> discount revoked!
        newDiscount = 0;
      }
    }
  }

  const newShippingCharge = newSubtotal > 50000 || newSubtotal === 0 ? 0 : 50;
  const newGrandTotal = Math.max(0, newSubtotal + newShippingCharge - newDiscount);

  let refundAmount = 0;
  if (order.paymentStatus === "Paid" || order.paymentStatus === "Refunded") {
    refundAmount = Math.max(0, previousGrandTotal - newGrandTotal);
  }

  order.subtotal = newSubtotal;
  order.discount = newDiscount;
  order.couponDiscount = newDiscount;
  order.shippingCharge = newShippingCharge;
  order.grandTotal = newGrandTotal;

  return refundAmount;
};
