import express from "express";

import { protect } from "../../middlewares/authMiddleware.js";
import upload
from "../../middlewares/uploadMiddleware.js";


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


// PROFILE PAGE
router.get("/", protect, loadProfile);


// ADDRESS PAGE
router.get("/address", protect, loadAddressPage);


// ADD ADDRESS PAGE
router.get("/address/add", protect, loadAddAddressPage);


// EDIT ADDRESS PAGE
router.get("/address/edit/:id", protect, loadEditAddressPage);


// UPDATE ADDRESS
router.post("/address/edit/:id", protect, updateAddress);


// SET DEFAULT ADDRESS
router.get(
  "/address/default/:id",
  protect,
  setDefaultAddress
);
// Delete Address
router.get(
  "/address/delete/:id",
  protect,
  deleteAddress
);
router.get("/logout", logout);

// UPDATE ACCOUNT
router.post("/account/update", protect, updateAccount);
// UPDATE PROFILE IMAGE
// CHANGE PASSWORD

router.post(

  "/change-password",

  protect,

  changePassword

);

router.post(

  "/update-profile-image",

  protect,

  upload.single("profileImage"),

  updateProfileImage

);
// VERIFY PROFILE OTP
router.post(
  "/verify-profile-otp",
  protect,
  verifyProfileOtp
);



// ADD ADDRESS
router.post("/add-address", protect, addAddress);


export default router;