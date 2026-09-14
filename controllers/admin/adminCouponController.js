import {
  getCouponsWithPagination,
  validateCouponInput,
  findCouponByCode,
  createCouponService,
  updateCouponService,
  deleteCouponService
} from "../../services/admin/couponService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const loadCouponsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";

    const data = await getCouponsWithPagination({ page, limit: 5, search });

    res.render("admin/coupons", {
      coupons: data.coupons,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
      totalCoupons: data.totalCoupons,
      search: data.search
    });
  } catch (error) {
    console.error("Load coupons error:", error);
    req.session.error = "Failed to load coupons.";
    res.redirect("/admin/dashboard");
  }
};

export const createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, minPurchase, maxDiscount, expiryDate, usageLimit } = req.body;

    const validationError = validateCouponInput({ code, discountType, discountValue, minPurchase, expiryDate });
    if (validationError) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: validationError });
    }

    const existing = await findCouponByCode(code);
    if (existing) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Coupon code already exists." });
    }

    await createCouponService({ code, discountType, discountValue, minPurchase, maxDiscount, expiryDate, usageLimit });

    res.status(HTTP_STATUS.OK).json({ success: true, message: "Coupon created successfully." });
  } catch (error) {
    console.error("Create coupon error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to create coupon." });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const { couponId, code, discountType, discountValue, minPurchase, maxDiscount, expiryDate, usageLimit } = req.body;

    if (!couponId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Coupon ID is required." });
    }

    const validationError = validateCouponInput({ code, discountType, discountValue, minPurchase, expiryDate });
    if (validationError) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: validationError });
    }

    const existing = await findCouponByCode(code, couponId);
    if (existing) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Coupon code already in use by another coupon."
      });
    }

    await updateCouponService(couponId, {
      code,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      expiryDate,
      usageLimit
    });

    res.status(HTTP_STATUS.OK).json({ success: true, message: "Coupon updated successfully." });
  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to update coupon." });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    await deleteCouponService(req.params.id);
    res.status(HTTP_STATUS.OK).json({ success: true, message: "Coupon deleted successfully." });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to delete coupon." });
  }
};
