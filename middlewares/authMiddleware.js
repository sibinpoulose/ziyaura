import jwt from "jsonwebtoken";

import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies.userToken;

    if (!token) {
      return res.redirect("/login");
    }

    const decoded = jwt.verify(
      token,

      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.redirect("/login");
    }

    if (user.isBlocked) {
      res.clearCookie("userToken");

      req.session.error = "Your account has been blocked";

      return res.redirect("/login");
    }

    req.user = user;

    next();
  } catch (err) {
    return res.redirect("/login");
  }
};
export const adminProtect = async (req, res, next) => {
  try {
    const token = req.cookies.adminToken;

    if (!token) {
      return res.redirect("/admin/login");
    }

    const decoded = jwt.verify(
      token,

      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.redirect("/admin/login");
    }

    if (user.role !== "admin") {
      return res.redirect("/home");
    }

    req.admin = user;
    req.user = user;

    next();
  } catch (err) {
    return res.redirect("/admin/login");
  }
};
