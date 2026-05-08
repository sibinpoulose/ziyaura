import express from "express";
import User from "../../models/User.js";
import passport from "../../config/passport.js";
import {
  signup,
  login,
  sendOTP,
  verifyOTP,
  logout,
  forgotPassword,
  verifyOtpReset,
  resetPassword
} from "../../controllers/user/authController.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router = express.Router();
router.get("/login", (req, res) => {
  res.render("user/login");
});

router.get("/signup", (req, res) => {
  res.render("user/signup");
});
router.get("/otp", (req, res) => res.render("user/otp"))

router.get("/home", (req, res) => res.render("user/home"));

router.get("/forgot-password", (req, res) => {
  res.render("user/forgot-password");
});
// GOOGLE LOGIN

router.get(

  "/auth/google",

  passport.authenticate("google", {

    scope: ["profile", "email"]

  })
  

);


// GOOGLE CALLBACK

router.get(

  "/auth/google/callback",

  passport.authenticate("google", {

    failureRedirect: "/login"

  }),

  (req, res) => {

    res.cookie(

      "token",

      req.user.token,

      {

        httpOnly: true,

        maxAge: 24 * 60 * 60 * 1000

      }

    );

    res.redirect("/home");

  }

);

router.get("/profile/edit", (req, res) => res.render("edit-profile"))
router.post("/signup", signup);
router.post("/login", login);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp-reset", verifyOtpReset);
router.post("/reset-password", resetPassword);

export default router;