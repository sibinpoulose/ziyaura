import express from "express";

import { protect } from "../../middlewares/authMiddleware.js";
import { handleProfileUpload } from "../../middlewares/uploadMiddleware.js";

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
  changePassword,
  loadProfileOtpPage,
  resendProfileOtp
} from "../../controllers/user/profileController.js";

const router = express.Router();

router.get("/", protect, loadProfile);
router.get("/profile-otp", protect, loadProfileOtpPage);
router.get("/address", protect, loadAddressPage);
router.get("/address/add", protect, loadAddAddressPage);
router.get("/address/edit/:id", protect, loadEditAddressPage);
router.post("/address/edit/:id", protect, updateAddress);
router.get("/address/default/:id", protect, setDefaultAddress);
router.get("/address/delete/:id", protect, deleteAddress);
router.get("/logout", logout);
router.post("/account/update", protect, updateAccount);
router.post("/change-password", protect, changePassword);

// UPDATE PROFILE IMAGE (Using named middleware instead of inline closure)
router.post("/update-profile-image", protect, handleProfileUpload, updateProfileImage);

router.post("/verify-profile-otp", protect, verifyProfileOtp);
router.post("/resend-profile-otp", protect, resendProfileOtp);
router.post("/add-address", protect, addAddress);

export default router;
