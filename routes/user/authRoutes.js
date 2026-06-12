import express from "express";
import User from "../../models/User.js";
import Category from "../../models/category.js";
import passport from "../../config/passport.js";
import {
  signup,
  login,
  sendOTP,
  verifyOTP,
  forgotPassword,
  verifyOtpReset,
  resetPassword
} from "../../controllers/user/authController.js";
import { protect } from "../../middlewares/authMiddleware.js";
import { isGuest } from "../../middlewares/guestMiddleware.js";

const router = express.Router();
router.get("/", (req, res) => {
  res.redirect("/home");
});

router.get("/login", isGuest, (req, res) => {
  res.render("user/login");
});

router.get("/signup", isGuest, (req, res) => {
  res.render("user/signup");
});
router.get("/otp", isGuest, async (req, res) => {
  try {
    const email = req.session.email;
    if (!email) {
      return res.redirect("/signup");
    }
    const user = await User.findOne({ email });
    const timeLeft = user && user.otpExpiry ? Math.max(0, Math.floor((user.otpExpiry.getTime() - Date.now()) / 1000)) : 0;
    res.render("user/otp", {
      email,
      timeLeft
    });
  } catch (err) {
    req.session.error = err.message;
    res.redirect("/signup");
  }
});

router.get("/home", async (req, res) => {
  try {
    let featuredCategories = await Category.find({ isListed: true, isFeatured: true }).limit(4);
    
    // Fallback: if less than 4 are featured, fill with standard listed categories
    if (featuredCategories.length < 4) {
      const remaining = 4 - featuredCategories.length;
      const featuredIds = featuredCategories.map(c => c._id);
      const extraCategories = await Category.find({
        isListed: true,
        _id: { $not: { $in: featuredIds } }
      }).limit(remaining);
      featuredCategories = [...featuredCategories, ...extraCategories];
    }
    
    res.render("user/home", { featuredCategories });
  } catch (error) {
    console.error("Load Home Page Categories Error:", error);
    res.render("user/home", { featuredCategories: [] });
  }
});

router.get("/forgot-password", isGuest, (req, res) => {
  res.render("user/forgot-password");
});

router.get(
  "/auth/google",

  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

router.get(
  "/auth/google/callback",

  passport.authenticate("google", {
    failureRedirect: "/login"
  }),

  (req, res) => {
    res.cookie(
      "userToken",

      req.user.token,

      {
        httpOnly: true,

        maxAge: 24 * 60 * 60 * 1000
      }
    );

    res.redirect("/home");
  }
);

router.post("/signup", signup);
router.post("/login", login);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp-reset", verifyOtpReset);
router.post("/reset-password", resetPassword);

export default router;
