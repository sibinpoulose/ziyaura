import User from "../../models/User.js";

export const getCustomersWithPagination = async ({ search = "", page = 1, limit = 5 }) => {
  const skip = (page - 1) * limit;

  const searchQuery = {
    role: "user",
    ...(search && {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ]
    })
  };

  const [users, totalUsers] = await Promise.all([
    User.find(searchQuery).sort({ isBlocked: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(searchQuery)
  ]);

  const totalPages = Math.ceil(totalUsers / limit);

  return {
    users,
    totalUsers,
    totalPages,
    currentPage: page
  };
};

export const setUserBlockedStatus = async (userId, isBlocked) => {
  return await User.findByIdAndUpdate(userId, { isBlocked }, { new: true });
};
