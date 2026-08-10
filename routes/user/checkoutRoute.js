import express from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import {
  loadCheckoutPage,
  placeOrder,
  verifyRazorpayPayment,
  handlePaymentFailure,
  loadOrderSuccessPage,
  loadPaymentFailurePage,
  initiateRepayment
} from "../../controllers/user/checkoutController.js";
import { applyCoupon, removeCoupon } from "../../controllers/user/couponController.js";
import { loadWalletPage } from "../../controllers/user/orderController.js";
import { generateReferralCode } from "../../controllers/user/referralController.js";

const router = express.Router();

router.get("/checkout", protect, loadCheckoutPage);
router.post("/checkout/place-order", protect, placeOrder);
router.post("/checkout/verify-payment", protect, verifyRazorpayPayment);
router.post("/checkout/payment-failure", protect, handlePaymentFailure);
router.get("/order-success/:orderId", protect, loadOrderSuccessPage);
router.get("/payment-failure/:orderId", protect, loadPaymentFailurePage);
router.post("/checkout/retry-payment/:orderId", protect, initiateRepayment);

// Coupon apply and remove routes
router.post("/coupons/apply", protect, applyCoupon);
router.post("/coupons/remove", protect, removeCoupon);

// Wallet profile endpoints
router.get("/profile/wallet", protect, loadWalletPage);

// Referral endpoint
router.get("/profile/referral", protect, generateReferralCode);

export default router;