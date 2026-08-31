import User from "../../models/User.js";

export const findUserById = async (id) => {
  return await User.findById(id);
};

export const findUserByEmail = async (email) => {
  return await User.findOne({ email });
};

export const findUserByReferralCode = async (referralCode) => {
  return await User.findOne({ referralCode });
};

export const updateUserById = async (id, updateData) => {
  return await User.findByIdAndUpdate(id, updateData, { new: true });
};

export const getAllUsers = async (query = {}, sort = { createdAt: -1 }) => {
  return await User.find(query).sort(sort);
};
