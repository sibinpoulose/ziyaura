import Address from "../../models/address.js";

export const getUserAddresses = async (userId) => {
  return await Address.find({ userId });
};

export const getAddressById = async (id, userId) => {
  return await Address.findOne({ _id: id, userId });
};

export const createAddress = async (addressData) => {
  return await Address.create(addressData);
};

export const updateAddressById = async (id, userId, updateData) => {
  return await Address.findOneAndUpdate({ _id: id, userId }, updateData, { new: true });
};

export const deleteAddressById = async (id, userId) => {
  return await Address.findOneAndDelete({ _id: id, userId });
};

export const clearDefaultAddresses = async (userId) => {
  return await Address.updateMany({ userId }, { $set: { isDefault: false } });
};
