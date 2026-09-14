import User from "../../models/User.js";
import Address from "../../models/address.js";
import Coupon from "../../models/coupon.js";
import { comparePassword, hashPassword } from "../../utils/hash.js";

export const getUserProfileData = async (userId, protocol, host) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (!user.referralCode) {
    user.referralCode = "REF-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    await user.save();
  }

  const addresses = await Address.find({ userId }).lean();
  const referralUrl = `${protocol}://${host}/signup?ref=${user.referralCode}`;

  return {
    user,
    addresses,
    referralUrl,
    scrollToPassword: false
  };
};

export const updateUserBasicInfo = async (userId, { name, phone }) => {
  return await User.findByIdAndUpdate(userId, { name, phone }, { new: true });
};

export const checkExistingEmail = async (email) => {
  return await User.findOne({ email });
};

export const updateUserEmailAndInfo = async (userId, { name, email, phone }) => {
  return await User.findByIdAndUpdate(userId, { name, email, phone }, { new: true });
};

export const updateUserProfileImage = async (userId, imagePath) => {
  return await User.findByIdAndUpdate(userId, { profileImage: imagePath }, { new: true });
};

export const changeUserPasswordService = async (userId, { currentPassword, newPassword, confirmPassword }) => {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const user = await User.findById(userId);
  if (!user) {
    return { error: "User not found" };
  }

  const isMatch = await comparePassword(currentPassword, user.password);
  if (!isMatch) {
    return { error: "Current password is incorrect" };
  }

  const hashedPassword = await hashPassword(newPassword);
  user.password = hashedPassword;
  await user.save();

  return { success: true };
};

export const getActiveUserCouponsData = async (userId) => {
  const [user, coupons] = await Promise.all([
    User.findById(userId).lean(),
    Coupon.find({
      isActive: true,
      expiryDate: { $gt: new Date() }
    })
      .sort({ createdAt: -1 })
      .lean()
  ]);

  return { user, coupons };
};
