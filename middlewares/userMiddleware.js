import jwt from "jsonwebtoken";
import User from "../models/User.js";   

export const attachUser = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      
      const user = await User.findById(decoded.id).select("-password");

      req.user = user;
    } else {
      req.user = null;
    }

  } catch (err) {
    req.user = null;
  }

  next();
};