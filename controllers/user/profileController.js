import {
  getUserProfileData,
  updateUserBasicInfo,
  checkExistingEmail,
  updateUserEmailAndInfo,
  updateUserProfileImage,
  changeUserPasswordService,
  getActiveUserCouponsData
} from "../../services/user/profileService.js";
import {
  getUserAddresses,
  getAddressById,
  createAddress,
  updateAddressById,
  deleteAddressById,
  clearDefaultAddresses
} from "../../services/user/addressService.js";
import { sendMail } from "../../utils/mail.js";
import { generateOTP } from "../../utils/otp.js";

export const loadProfile = async (req, res) => {
  try {
    req.session.profileOtp = null;
    req.session.profileOtpExpiry = null;
    req.session.pendingProfile = null;

    const data = await getUserProfileData(req.user._id, req.protocol, req.get("host"));
    res.render("user/profile", data);
  } catch (err) {
    console.error("Load Profile Error:", err);
    res.redirect("/");
  }
};

export const updateAccount = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const nameTrimmed = name ? name.trim() : "";
    if (nameTrimmed.length < 3 || nameTrimmed.length > 50 || !/^[A-Za-z\s]+$/.test(nameTrimmed)) {
      req.session.error = "Name must be 3-50 characters and contain only letters and spaces";
      return res.redirect("/profile");
    }

    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      req.session.error = "Phone number must be exactly 10 digits";
      return res.redirect("/profile");
    }

    if (email === req.user.email) {
      await updateUserBasicInfo(req.user._id, { name: nameTrimmed, phone });
      req.session.success = "Account updated successfully";
      return res.redirect("/profile");
    }

    const existingUser = await checkExistingEmail(email);
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

    await sendMail(req.user.email, otp);

    req.session.success = `Security Check: OTP sent to your current email address (${req.user.email})`;
    res.redirect("/profile/profile-otp");
  } catch (err) {
    console.error("Update Account Error:", err);
    req.session.error = "Failed to update account: " + err.message;
    res.redirect("/profile");
  }
};

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

    if (stage === "verify_old") {
      const newOtp = generateOTP();
      req.session.profileOtp = newOtp;
      req.session.profileOtpExpiry = Date.now() + 5 * 60 * 1000;
      req.session.emailChangeStage = "verify_new";

      await sendMail(pendingProfile.email, newOtp);

      req.session.success = `Current email verified! Now enter the OTP sent to your new email (${pendingProfile.email})`;
      return res.redirect("/profile/profile-otp");
    }

    await updateUserEmailAndInfo(req.user._id, {
      name: pendingProfile.name,
      email: pendingProfile.email,
      phone: pendingProfile.phone
    });

    req.session.profileOtp = null;
    req.session.profileOtpExpiry = null;
    req.session.emailChangeStage = null;
    req.session.pendingProfile = null;

    req.session.success = "Email address and profile updated successfully";
    res.redirect("/profile");
  } catch (err) {
    console.error("Verify Profile OTP Error:", err);
    req.session.error = "Failed to verify OTP: " + err.message;
    res.redirect("/profile");
  }
};

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
    console.error("Load Profile OTP Page Error:", err);
    res.redirect("/profile");
  }
};

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

    req.session.success = `OTP resent successfully to ${email}`;
    res.redirect("/profile/profile-otp");
  } catch (err) {
    console.error("Resend Profile OTP Error:", err);
    req.session.error = "Failed to resend OTP";
    res.redirect("/profile/profile-otp");
  }
};

export const loadAddressPage = async (req, res) => {
  try {
    const addresses = await getUserAddresses(req.user._id);
    res.render("user/address", { addresses });
  } catch (err) {
    console.error("Load Address Page Error:", err);
    res.redirect("/profile");
  }
};

export const loadAddAddressPage = (req, res) => {
  res.render("user/add-address");
};

export const addAddress = async (req, res) => {
  try {
    const { fullName, phone, address, landmark, city, state, pincode, addressType, isDefault } = req.body;

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

    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      if (data && data[0] && data[0].Status === "Error") {
        req.session.error = "Invalid pincode or location not found";
        return res.redirect(req.headers.referer || "/profile/address");
      }
    } catch (apiError) {
      console.warn("Pincode verification offline, skipping:", apiError.message);
    }

    if (isDefault === "on") {
      await clearDefaultAddresses(req.user._id);
    }

    const existingAddresses = await getUserAddresses(req.user._id);

    await createAddress({
      userId: req.user._id,
      fullName: fullName.trim(),
      phone,
      address: address.trim(),
      landmark: landmark ? landmark.trim() : "",
      city: city.trim(),
      state: state.trim(),
      pincode,
      addressType,
      isDefault: existingAddresses.length > 0 ? isDefault === "on" : true
    });

    req.session.success = "Address added successfully";

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
    console.error("Add Address Error:", err);
    req.session.error = "Failed to add address: " + err.message;
    res.redirect(req.headers.referer || "/profile/address");
  }
};

export const loadEditAddressPage = async (req, res) => {
  try {
    const address = await getAddressById(req.params.id, req.user._id);
    if (!address) {
      req.session.error = "Address not found";
      return res.redirect("/profile/address");
    }

    res.render("user/edit-address", {
      address,
      from: req.query.from || ""
    });
  } catch (err) {
    console.error("Load Edit Address Error:", err);
    req.session.error = "Failed to load address";
    res.redirect("/profile/address");
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { fullName, phone, address, landmark, city, state, pincode, addressType, isDefault } = req.body;
    const fromParam = req.query.from ? `?from=${req.query.from}` : "";

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

    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      if (data && data[0] && data[0].Status === "Error") {
        req.session.error = "Invalid pincode or location not found";
        return res.redirect(`/profile/address/edit/${req.params.id}`);
      }
    } catch (apiError) {
      console.warn("Pincode verification offline, skipping:", apiError.message);
    }

    if (isDefault === "on") {
      await clearDefaultAddresses(req.user._id);
    }

    await updateAddressById(req.params.id, req.user._id, {
      fullName: fullName.trim(),
      phone,
      address: address.trim(),
      landmark: landmark ? landmark.trim() : "",
      city: city.trim(),
      state: state.trim(),
      pincode,
      addressType,
      isDefault: isDefault === "on"
    });

    req.session.success = "Address updated successfully";

    let redirectTo = "/profile/address";
    if (req.query.from === "checkout" || (req.headers.referer && req.headers.referer.includes("checkout"))) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  } catch (err) {
    console.error("Update Address Error:", err);
    req.session.error = "Failed to update address: " + err.message;

    let redirectTo = "/profile/address";
    if (req.query.from === "checkout" || (req.headers.referer && req.headers.referer.includes("checkout"))) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    await clearDefaultAddresses(req.user._id);
    await updateAddressById(req.params.id, req.user._id, { isDefault: true });

    req.session.success = "Default address updated";

    let redirectTo = "/profile/address";
    if (req.headers.referer && req.headers.referer.includes("checkout")) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  } catch (err) {
    console.error("Set Default Address Error:", err);
    req.session.error = "Failed to update default address";

    let redirectTo = "/profile/address";
    if (req.headers.referer && req.headers.referer.includes("checkout")) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  }
};

export const deleteAddress = async (req, res) => {
  try {
    await deleteAddressById(req.params.id, req.user._id);
    req.session.success = "Address deleted successfully";

    let redirectTo = "/profile/address";
    if (req.headers.referer && req.headers.referer.includes("checkout")) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  } catch (err) {
    console.error("Delete Address Error:", err);
    req.session.error = "Failed to delete address";

    let redirectTo = "/profile/address";
    if (req.headers.referer && req.headers.referer.includes("checkout")) {
      redirectTo = "/checkout";
    }
    res.redirect(redirectTo);
  }
};

export const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      req.session.error = "Only image files are allowed";
      return res.redirect("/profile");
    }

    await updateUserProfileImage(req.user._id, req.file.path);
    req.session.success = "Profile image updated successfully";
    res.redirect("/profile");
  } catch (err) {
    console.error("Update Profile Image Error:", err);
    req.session.error = "Failed to upload image";
    res.redirect("/profile");
  }
};

export const logout = (req, res) => {
  res.clearCookie("userToken");
  req.session.success = "Logged out successfully";
  res.redirect("/login");
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const result = await changeUserPasswordService(req.user._id, {
      currentPassword,
      newPassword,
      confirmPassword
    });

    if (result.error) {
      req.session.error = result.error;
      return res.redirect("/profile");
    }

    req.session.success = "Password changed successfully";
    return res.redirect("/profile");
  } catch (err) {
    console.error("Change Password Error:", err);
    req.session.error = "Failed to change password";
    res.redirect("/profile");
  }
};

export const loadUserCoupons = async (req, res) => {
  try {
    const data = await getActiveUserCouponsData(req.user._id);
    res.render("user/coupons", {
      ...data,
      requestPath: "/profile/coupons"
    });
  } catch (err) {
    console.error("Load User Coupons Error:", err);
    res.redirect("/profile");
  }
};
