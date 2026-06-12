import jwt from "jsonwebtoken";

import User from "../models/User.js";

export const attachUser = async (req, res, next) => {
  try {
    req.user = null;

    // USER TOKEN

    if (req.cookies.userToken) {
      const decoded = jwt.verify(
        req.cookies.userToken,

        process.env.JWT_SECRET
      );

      const user = await User.findById(decoded.id).select("-password");

      if (user && user.role === "user") {
        req.user = user;
      }
    }

    // ADMIN TOKEN

    if (req.cookies.adminToken) {
      const decoded = jwt.verify(
        req.cookies.adminToken,

        process.env.JWT_SECRET
      );

      const admin = await User.findById(decoded.id).select("-password");

      if (admin && admin.role === "admin") {
        req.user = admin;
      }
    }
  } catch (err) {
    req.user = null;
  }

  next();
};
