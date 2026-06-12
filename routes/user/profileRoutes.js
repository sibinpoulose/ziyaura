import express from "express";

import { sendOtp } from "../../services/user/authService.js";

import { protect } from "../../middlewares/authMiddleware.js";

import upload from "../../middlewares/uploadMiddleware.js";

import {
  loadProfile,
  updateAccount,
  verifyProfileOtp,
  addAddress,
  loadAddressPage,
  loadAddAddressPage,
  loadEditAddressPage,
  deleteAddress,
  updateAddress,
  updateProfileImage,
  setDefaultAddress,
  logout,
  changePassword
} from "../../controllers/user/profileController.js";

const router = express.Router();

router.get(
  "/",
  protect,

  loadProfile
);

router.get(
  "/profile-otp",

  protect,

  (req, res) => {
    const expiry = req.session.profileOtpExpiry || Date.now();
    const timeLeft = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
    res.render(
      "user/profile-otp",

      {
        email: req.user.email,
        timeLeft
      }
    );
  }
);

router.get(
  "/address",

  protect,

  loadAddressPage
);

router.get(
  "/address/add",

  protect,

  loadAddAddressPage
);

// EDIT ADDRESS PAGE

router.get(
  "/address/edit/:id",

  protect,

  loadEditAddressPage
);

// UPDATE ADDRESS

router.post(
  "/address/edit/:id",

  protect,

  updateAddress
);

// SET DEFAULT ADDRESS

router.get(
  "/address/default/:id",

  protect,

  setDefaultAddress
);

// DELETE ADDRESS

router.get(
  "/address/delete/:id",

  protect,

  deleteAddress
);

// LOGOUT

router.get(
  "/logout",

  logout
);

// UPDATE ACCOUNT

router.post(
  "/account/update",

  protect,

  updateAccount
);

// CHANGE PASSWORD

router.post(
  "/change-password",

  protect,

  changePassword
);

// UPDATE PROFILE IMAGE

router.post(
  "/update-profile-image",

  protect,

  (req, res, next) => {
    upload.single("profileImage")(
      req,
      res,

      (err) => {
        if (err) {
          req.session.error = err.message;

          return res.redirect("/profile");
        }

        next();
      }
    );
  },

  updateProfileImage
);

// VERIFY PROFILE OTP

router.post(
  "/verify-profile-otp",

  protect,

  verifyProfileOtp
);

// RESEND PROFILE OTP

router.post(
  "/resend-profile-otp",

  protect,

  async (req, res) => {
    try {
      await sendOtp(req.user.email);

      req.session.success = "OTP resent successfully";

      res.redirect("/profile/profile-otp");
    } catch (err) {
      req.session.error = "Failed to resend OTP";

      res.redirect("/profile/profile-otp");
    }
  }
);

// ADD ADDRESS

router.post(
  "/add-address",

  protect,

  addAddress
);

export default router;
