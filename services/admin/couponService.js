import Coupon from "../../models/coupon.js";

export const getCouponsWithPagination = async ({ page = 1, limit = 5, search = "" }) => {
  const skip = (page - 1) * limit;

  const query = {};
  if (search) {
    query.$or = [
      { code: { $regex: search, $options: "i" } },
      { discountType: { $regex: search, $options: "i" } }
    ];
  }

  const [coupons, totalCoupons] = await Promise.all([
    Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Coupon.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalCoupons / limit) || 1;

  return {
    coupons,
    totalCoupons,
    totalPages,
    currentPage: page,
    search
  };
};

export const validateCouponInput = ({ code, discountType, discountValue, minPurchase, expiryDate }) => {
  if (!code || !discountType || !discountValue || !expiryDate) {
    return "Please fill all required fields.";
  }

  const numericDiscount = parseFloat(discountValue);
  const numericMinPurchase = parseFloat(minPurchase) || 0;

  if (isNaN(numericDiscount) || numericDiscount <= 0) {
    return "Discount value must be greater than zero.";
  }

  if (discountType === "percentage" && numericDiscount > 100) {
    return "Percentage discount cannot exceed 100%.";
  }

  if (numericDiscount >= numericMinPurchase) {
    return "Discount value should be lower than min purchase price.";
  }

  const parsedExpDate = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(parsedExpDate.getTime())) {
    return "Please enter a valid expiry date.";
  }

  if (parsedExpDate < today) {
    return "Coupon expiry date cannot be in the past.";
  }

  return null;
};

export const findCouponByCode = async (code, excludeId = null) => {
  const query = { code: code.toUpperCase() };
  if (excludeId) query._id = { $ne: excludeId };
  return await Coupon.findOne(query);
};

export const createCouponService = async (couponData) => {
  return await Coupon.create({
    code: couponData.code.toUpperCase(),
    discountType: couponData.discountType,
    discountValue: parseFloat(couponData.discountValue),
    minPurchase: parseFloat(couponData.minPurchase) || 0,
    maxDiscount: couponData.maxDiscount ? parseFloat(couponData.maxDiscount) : null,
    expiryDate: new Date(couponData.expiryDate),
    usageLimit: couponData.usageLimit ? parseInt(couponData.usageLimit) : null
  });
};

export const updateCouponService = async (couponId, couponData) => {
  return await Coupon.findByIdAndUpdate(
    couponId,
    {
      code: couponData.code.toUpperCase(),
      discountType: couponData.discountType,
      discountValue: parseFloat(couponData.discountValue),
      minPurchase: parseFloat(couponData.minPurchase) || 0,
      maxDiscount: couponData.maxDiscount ? parseFloat(couponData.maxDiscount) : null,
      expiryDate: new Date(couponData.expiryDate),
      usageLimit: couponData.usageLimit ? parseInt(couponData.usageLimit) : null
    },
    { new: true }
  );
};

export const deleteCouponService = async (couponId) => {
  return await Coupon.findByIdAndDelete(couponId);
};
