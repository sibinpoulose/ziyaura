import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Category from "../models/category.js";
import Cart from "../models/Cart.js";
import Wishlist from "../models/Wishlist.js";

export const attachUser = async (req, res, next) => {
  try {
    req.user = null;
    req.admin = null;

    // USER TOKEN

    if (req.cookies.userToken) {
      const decoded = jwt.verify(
        req.cookies.userToken,

        process.env.JWT_SECRET
      );

      const user = await User.findById(decoded.id).select("-password");

      if (user && user.role === "user") {
        if (user.isBlocked) {
          res.clearCookie("userToken");
          req.session.error = "Your account has been blocked";
        } else {
          req.user = user;
        }
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
        req.admin = admin;
      }
    }

    // Set res.locals values
    res.locals.user = req.user || null;
    res.locals.admin = req.admin || null;
    res.locals.requestPath = req.path;

    // Global Cart Count
    res.locals.cartCount = 0;
    if (req.user && req.user.role === "user") {
      try {
        const cart = await Cart.findOne({ userId: req.user._id });
        res.locals.cartCount = cart ? cart.items.reduce((total, item) => total + item.quantity, 0) : 0;
      } catch (error) {
        console.error("Global cart count error:", error);
      }
    }

    // Global Wishlist IDs
    res.locals.wishlistProductIds = [];
    res.locals.wishlistCount = 0;
    if (req.user && req.user.role === "user") {
      try {
        const wishlist = await Wishlist.findOne({ userId: req.user._id });
        if (wishlist) {
          res.locals.wishlistProductIds = wishlist.items.map(item => item.productId.toString());
          res.locals.wishlistCount = wishlist.items.length;
        }
      } catch (error) {
        console.error("Global wishlist IDs error:", error);
      }
    }

    // Global Categories
    try {
      res.locals.categories = await Category.find({ isListed: true });
    } catch (error) {
      res.locals.categories = [];
    }
  } catch (err) {
    req.user = null;
    req.admin = null;
    res.locals.user = null;
    res.locals.admin = null;
    res.locals.cartCount = 0;
    res.locals.wishlistProductIds = [];
    res.locals.wishlistCount = 0;
    res.locals.categories = [];
  }

  next();
};
