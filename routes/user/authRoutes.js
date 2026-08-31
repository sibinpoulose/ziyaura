import express from "express";
import passport from "../../config/passport.js";
import {
  signup,
  login,
  sendOTP,
  verifyOTP,
  forgotPassword,
  verifyOtpReset,
  resetPassword,
  redirectToHome,
  loadLoginPage,
  loadSignupPage,
  loadOtpPage,
  loadHomePage,
  loadForgotPasswordPage,
  handleGoogleCallback
} from "../../controllers/user/authController.js";
import { protect } from "../../middlewares/authMiddleware.js";
import { isGuest } from "../../middlewares/guestMiddleware.js";

const router = express.Router();
router.get("/", redirectToHome);

router.get("/login", isGuest, loadLoginPage);
router.get("/signup", isGuest, loadSignupPage);
router.get("/otp", isGuest, loadOtpPage);
router.get("/home", loadHomePage);
router.get("/forgot-password", isGuest, loadForgotPasswordPage);

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

router.get(
  "/auth/google/callback",
  handleGoogleCallback
);

router.post("/signup", signup);
router.post("/login", login);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp-reset", verifyOtpReset);
router.post("/reset-password", resetPassword);

export default router;
