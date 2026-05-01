import express from "express";
import {
  signup,
  login,
  sendOTP,
  verifyOTP,
  logout,
  forgotPassword,
  verifyOtpReset,
  resetPassword
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/signup", (req, res) => res.render("signup", { message: "" }));
router.get("/login", (req, res) => res.render("login", { message: "" }));
router.get("/otp", (req, res) => res.render("otp", { message: "" }));

router.get("/home", protect, (req, res) => res.render("home"));

router.get("/logout", logout);

router.get("/forgot-password", (req, res) => {
  res.render("forgot-password", { message: "" });
});

router.post("/signup", signup);
router.post("/login", login);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp-reset", verifyOtpReset);
router.post("/reset-password", resetPassword);

export default router;