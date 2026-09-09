import User from "../../models/User.js";
import Address from "../../models/address.js";
import Coupon from "../../models/coupon.js";
import { sendMail } from "../../utils/mail.js";
import { generateOTP } from "../../utils/otp.js";
import { comparePassword } from "../../utils/hash.js";

import { hashPassword } from "../../utils/hash.js";

// LOAD PROFILE PAGE
export const loadProfile = async (req, res) => {
  try {
    // Clear pending email update session variables on fresh load
    req.session.profileOtp = null;
    req.session.profileOtpExpiry = null;
    req.session.pendingProfile = null;

    const user = await User.findById(req.user._id);

    if (!user.referralCode) {
      user.referralCode = "REF-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      await user.save();
    }

    const addresses = await Address.find({
      userId: req.user._id
    });

    const referralUrl = `${req.protocol}://${req.get("host")}/signup?ref=${user.referralCode}`;

    res.render("user/profile", {
      user,
      addresses,
      referralUrl,
      scrollToPassword: false
    });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
};

// UPDATE ACCOUNT
export const updateAccount = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Validate Name (3-50 chars, only letters and spaces)
    const nameTrimmed = name ? name.trim() : "";
    if (nameTrimmed.length < 3 || nameTrimmed.length > 50 || !/^[A-Za-z\s]+$/.test(nameTrimmed)) {
      req.session.error = "Name must be 3-50 characters and contain only letters and spaces";
      return res.redirect("/profile");
    }

    // Validate Phone (10 digits)
    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      req.session.error = "Phone number must be exactly 10 digits";
      return res.redirect("/profile");
    }

    const user = await User.findById(req.user._id);

    // EMAIL NOT CHANGED
    if (email === user.email) {
      await User.findByIdAndUpdate(
        req.user._id,
        {
          name: nameTrimmed,
          phone
        }
      );

      req.session.success = "Account updated successfully";
      return res.redirect("/profile");
    }

    // EMAIL CHANGED - START 2-STEP OTP (Step 1: Verify Old Email)
    const existingUser = await User.findOne({
      email
    });

    if (existingUser) {
      req.session.error = "Email is already in use by another account";
      return res.redirect("/profile");
    }

    const otp = generateOTP();

    req.session.profileOtp = otp;
    req.session.profileOtpExpiry = Date.now() + 5 * 60 * 1000;
    req.session.emailChangeStage = "verify_old";
    req.session.pendingProfile = {
      name: nameTrimmed,
      email,
      phone
    };

    // Send OTP to CURRENT email first for security verification
    await sendMail(user.email, otp);

    console.log("PROFILE OTP (OLD EMAIL):", otp);

    req.session.success = `Security Check: OTP sent to your current email address (${user.email})`;
    res.redirect("/profile/profile-otp");
  } catch (err) {
    console.log(err);
    req.session.error = "Failed to update account: " + err.message;
    res.redirect("/profile");
  }
};

// VERIFY PROFILE OTP
export const verifyProfileOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    const sessionOtp = req.session.profileOtp;
    const expiry = req.session.profileOtpExpiry;
    const pendingProfile = req.session.pendingProfile;
    const stage = req.session.emailChangeStage || "verify_new";

    const displayEmail = stage === "verify_old" ? req.user.email : pendingProfile?.email;
    const timeLeft = expiry ? Math.max(0, Math.floor((expiry - Date.now()) / 1000)) : 0;

    if (!sessionOtp) {
      return res.render("user/profile-otp", {
        email: displayEmail,
        error: "OTP not found",
        timeLeft
      });
    }

    if (otp !== sessionOtp) {
      return res.render("user/profile-otp", {
        email: displayEmail,
        error: "Invalid OTP",
        timeLeft
      });
    }

    if (Date.now() > expiry) {
      return res.render("user/profile-otp", {
        email: displayEmail,
        error: "OTP expired",
        timeLeft
      });
    }

    // IF STEP 1 (OLD EMAIL) WAS VERIFIED -> MOVE TO STEP 2 (NEW EMAIL)
    if (stage === "verify_old") {
      const newOtp = generateOTP();
      req.session.profileOtp = newOtp;
      req.session.profileOtpExpiry = Date.now() + 5 * 60 * 1000;
      req.session.emailChangeStage = "verify_new";

      await sendMail(pendingProfile.email, newOtp);
      console.log("PROFILE OTP (NEW EMAIL):", newOtp);

      req.session.success = `Current email verified! Now enter the OTP sent to your new email (${pendingProfile.email})`;
      return res.redirect("/profile/profile-otp");
    }

    // STEP 2 (NEW EMAIL) VERIFIED -> UPDATE USER FINALLY
    await User.findByIdAndUpdate(
      req.user._id,
      {
        name: pendingProfile.name,
        email: pendingProfile.email,
        phone: pendingProfile.phone
      }
    );

    req.session.profileOtp = null;
    req.session.profileOtpExpiry = null;
    req.session.emailChangeStage = null;
    req.session.pendingProfile = null;

    req.session.success = "Email address and profile updated successfully";
    res.redirect("/profile");
  } catch (err) {
    console.log(err);
    req.session.error = "Failed to verify OTP: " + err.message;
    res.redirect("/profile");
  }
};

// LOAD PROFILE OTP PAGE
export const loadProfileOtpPage = async (req, res) => {
  try {
    if (!req.session.pendingProfile) {
      return res.redirect("/profile");
    }

    const expiry = req.session.profileOtpExpiry || Date.now();
    const timeLeft = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
    const stage = req.session.emailChangeStage || "verify_new";
    const displayEmail = stage === "verify_old" ? req.user.email : req.session.pendingProfile.email;

    res.render("user/profile-otp", {
      email: displayEmail,
      timeLeft
    });
  } catch (err) {
    console.log(err);
    res.redirect("/profile");
  }
};

// RESEND PROFILE OTP
export const resendProfileOtp = async (req, res) => {
  try {
    if (!req.session.pendingProfile) {
      req.session.error = "No pending profile update found";
      return res.redirect("/profile");
    }

    const stage = req.session.emailChangeStage || "verify_new";
    const email = stage === "verify_old" ? req.user.email : req.session.pendingProfile.email;
    const otp = generateOTP();

    req.session.profileOtp = otp;
    req.session.profileOtpExpiry = Date.now() + 5 * 60 * 1000;

    await sendMail(email, otp);
    console.log("RESENT PROFILE OTP:", otp);

    req.session.success = `OTP resent successfully to ${email}`;
    res.redirect("/profile/profile-otp");
  } catch (err) {
    console.log(err);
    req.session.error = "Failed to resend OTP";
    res.redirect("/profile/profile-otp");
  }
};

// LOAD ADDRESS PAGE
export const loadAddressPage = async (req, res) => {
  try {
    const addresses = await Address.find({
      userId: req.user._id
    });

    res.render("user/address", {
      addresses
    });
  } catch (err) {
    console.log(err);

    res.redirect("/profile");
  }
};

// LOAD ADD ADDRESS PAGE
export const loadAddAddressPage = (req, res) => {
  res.render("user/add-address");
};

// ADD ADDRESS
export const addAddress = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      address,
      landmark,
      city,
      state,
      pincode,
      addressType,
      isDefault
    } = req.body;

    // Backend Validation
    const nameTrimmed = fullName ? fullName.trim() : "";
    if (!nameTrimmed || nameTrimmed.length < 3 || nameTrimmed.length > 50) {
      req.session.error = "Full Name must be between 3 and 50 characters";
      return res.redirect(req.headers.referer || "/profile/address");
    }
    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      req.session.error = "Phone number must be exactly 10 digits";
      return res.redirect(req.headers.referer || "/profile/address");
    }
    if (!address || !address.trim()) {
      req.session.error = "Address is required";
      return res.redirect(req.headers.referer || "/profile/address");
    }
    if (!city || !city.trim()) {
      req.session.error = "City is required";
      return res.redirect(req.headers.referer || "/profile/address");
    }
    if (!state || !state.trim()) {
      req.session.error = "State is required";
      return res.redirect(req.headers.referer || "/profile/address");
    }
    if (!pincode || !/^[0-9]{6}$/.test(pincode)) {
      req.session.error = "PIN code must be exactly 6 digits";
      return res.redirect(req.headers.referer || "/profile/address");
    }

    // CHECK PINCODE (gracefully check)
    try {
      const response = await fetch(
        `https://api.postalpincode.in/pincode/${pincode}`
      );
      const data = await response.json();
      if (data && data[0] && data[0].Status === "Error") {
        req.session.error = "Invalid pincode or location not found";
        return res.redirect(req.headers.referer || "/profile/address");
      }
    } catch (apiError) {
      console.log("Pincode verification service offline, skipping check:", apiError.message);
    }

    // REMOVE OLD DEFAULT

    if (isDefault === "on") {
      await Address.updateMany(
        {
          userId: req.user._id
        },

        {
          $set: {
            isDefault: false
          }
        }
      );
    }

    // CHECK EXISTING ADDRESS

    const existingAddress = await Address.findOne({
      userId: req.user._id
    });

    // CREATE ADDRESS

    await Address.create({
      userId: req.user._id,

      fullName: fullName.trim(),
      phone,
      address: address.trim(),
      landmark: landmark ? landmark.trim() : "",
      city: city.trim(),
      state: state.trim(),
      pincode,

      addressType,

      isDefault: existingAddress ? isDefault === "on" : true
    });

    req.session.success = "Address added successfully";

    // Redirect to referer page so it reloads the source view correctly
    let redirectTo = "/profile";
    if (req.headers.referer) {
      if (req.headers.referer.includes("checkout")) {
        redirectTo = "/checkout";
      } else if (req.headers.referer.includes("profile/address")) {
        redirectTo = "/profile/address";
      }
    }

    res.redirect(redirectTo);
  } catch (err) {
    console.log(err);

    req.session.error = "Failed to add address: " + err.message;

    res.redirect(req.headers.referer || "/profile/address");
  }
};

// LOAD EDIT ADDRESS PAGE
export const loadEditAddressPage = async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!address) {
      req.session.error = "Address not found";

      return res.redirect("/profile/address");
    }

    res.render("user/edit-address", {
      address,
      from: req.query.from || ""
    });
  } catch (err) {
    console.log(err);

    req.session.error = "Failed to load address";

    res.redirect("/profile/address");
  }
};

// UPDATE ADDRESS
export const updateAddress = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      address,
      landmark,
      city,
      state,
      pincode,
      addressType,
      isDefault
    } = req.body;

    const fromParam = req.query.from ? `?from=${req.query.from}` : "";

    // Backend Validation
    const nameTrimmed = fullName ? fullName.trim() : "";
    if (!nameTrimmed || nameTrimmed.length < 3 || nameTrimmed.length > 50) {
      req.session.error = "Full Name must be between 3 and 50 characters";
      return res.redirect(`/profile/address/edit/${req.params.id}${fromParam}`);
    }
    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      req.session.error = "Phone number must be exactly 10 digits";
      return res.redirect(`/profile/address/edit/${req.params.id}${fromParam}`);
    }
    if (!address || !address.trim()) {
      req.session.error = "Address is required";
      return res.redirect(`/profile/address/edit/${req.params.id}${fromParam}`);
    }
    if (!city || !city.trim()) {
      req.session.error = "City is required";
      return res.redirect(`/profile/address/edit/${req.params.id}${fromParam}`);
    }
    if (!state || !state.trim()) {
      req.session.error = "State is required";
      return res.redirect(`/profile/address/edit/${req.params.id}${fromParam}`);
    }
    if (!pincode || !/^[0-9]{6}$/.test(pincode)) {
      req.session.error = "PIN code must be exactly 6 digits";
      return res.redirect(`/profile/address/edit/${req.params.id}${fromParam}`);
    }

    // CHECK PINCODE (gracefully check)
    try {
      const response = await fetch(
        `https://api.postalpincode.in/pincode/${pincode}`
      );
      const data = await response.json();
      if (data && data[0] && data[0].Status === "Error") {
        req.session.error = "Invalid pincode or location not found";
        return res.redirect(`/profile/address/edit/${req.params.id}`);
      }
    } catch (apiError) {
      console.log("Pincode verification service offline, skipping check:", apiError.message);
    }

    // REMOVE PREVIOUS DEFAULT

    if (isDefault === "on") {
      await Address.updateMany(
        {
          userId: req.user._id
        },

        {
          $set: {
            isDefault: false
          }
        }
      );
    }

    // UPDATE ADDRESS

    await Address.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id
      },

      {
        fullName: fullName.trim(),
        phone,
        address: address.trim(),
        landmark: landmark ? landmark.trim() : "",
        city: city.trim(),
        state: state.trim(),
        pincode,

        addressType,

        isDefault: isDefault === "on"
      }
    );

    req.session.success = "Address updated successfully";

    let redirectTo = "/profile/address";
    if (req.query.from === "checkout" || (req.headers.referer && req.headers.referer.includes("checkout"))) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  } catch (err) {
    console.log(err);

    req.session.error = "Failed to update address: " + err.message;

    let redirectTo = "/profile/address";
    if (req.query.from === "checkout" || (req.headers.referer && req.headers.referer.includes("checkout"))) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  }
};

// SET DEFAULT ADDRESS
export const setDefaultAddress = async (req, res) => {
  try {
    // REMOVE OLD DEFAULT

    await Address.updateMany(
      {
        userId: req.user._id
      },

      {
        isDefault: false
      }
    );

    // SET NEW DEFAULT

    await Address.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id
      },

      {
        isDefault: true
      }
    );

    req.session.success = "Default address updated";

    let redirectTo = "/profile/address";
    if (req.headers.referer && req.headers.referer.includes("checkout")) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  } catch (err) {
    console.log(err);

    req.session.error = "Failed to update default address";

    let redirectTo = "/profile/address";
    if (req.headers.referer && req.headers.referer.includes("checkout")) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  }
};
// DELETE ADDRESS
export const deleteAddress = async (req, res) => {
  try {
    await Address.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    req.session.success = "Address deleted successfully";

    let redirectTo = "/profile/address";
    if (req.headers.referer && req.headers.referer.includes("checkout")) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  } catch (err) {
    console.log(err);

    req.session.error = "Failed to delete address";

    let redirectTo = "/profile/address";
    if (req.headers.referer && req.headers.referer.includes("checkout")) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  }
};
// UPDATE PROFILE IMAGE

export const updateProfileImage = async (req, res) => {
  try {
    // CHECK FILE EXISTS

    if (!req.file) {
      req.session.error = "Only image files are allowed";

      return res.redirect("/profile");
    }

    // SAVE CLOUDINARY IMAGE URL

    await User.findByIdAndUpdate(
      req.user._id,

      {
        profileImage: req.file.path
      }
    );

    req.session.success = "Profile image updated successfully";

    res.redirect("/profile");
  } catch (err) {
    console.log(err);

    req.session.error = "Failed to upload image";

    res.redirect("/profile");
  }
};
export const logout = (req, res) => {
  res.clearCookie("userToken");

  req.session.success = "Logged out successfully";

  res.redirect("/login");
};
// CHANGE PASSWORD

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // GET USER

    const user = await User.findById(req.user._id);

    // CHECK EMPTY

    if (!currentPassword || !newPassword || !confirmPassword) {
      req.session.error = "All fields are required";

      return res.redirect("/profile");
    }

    // CHECK PASSWORD MATCH

    if (newPassword !== confirmPassword) {
      req.session.error = "Passwords do not match";

      return res.redirect("/profile");
    }

    // CHECK CURRENT PASSWORD

    const isMatch = await comparePassword(
      currentPassword,

      user.password
    );

    if (!isMatch) {
      req.session.error = "Current password is incorrect";

      return res.redirect("/profile");
    }

    // HASH NEW PASSWORD

    const hashedPassword = await hashPassword(newPassword);

    // UPDATE PASSWORD

    user.password = hashedPassword;

    await user.save();

    req.session.success = "Password changed successfully";

    return res.redirect("/profile");
  } catch (err) {
    console.log(err);

    req.session.error = "Failed to change password";

    res.redirect("/profile");
  }
};

// LOAD USER COUPONS PAGE
export const loadUserCoupons = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const coupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.render("user/coupons", {
      user,
      coupons,
      requestPath: "/profile/coupons"
    });
  } catch (err) {
    console.error(err);
    res.redirect("/profile");
  }
};
