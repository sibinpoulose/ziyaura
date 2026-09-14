import { validateAndCalculateCoupon } from "../../services/user/couponService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const result = await validateAndCalculateCoupon({ userId: req.user._id, couponCode });

    if (result.error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: result.error });
    }

    req.session.couponCode = result.coupon.code;
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Coupon "${result.coupon.code}" applied successfully!`,
      ...result.coupon
    });
  } catch (error) {
    console.error("Apply Coupon Error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to apply coupon." });
  }
};

export const removeCoupon = async (req, res) => {
  try {
    delete req.session.couponCode;
    return res.status(HTTP_STATUS.OK).json({ success: true, message: "Coupon removed." });
  } catch (error) {
    console.error("Remove Coupon Error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to remove coupon." });
  }
};
