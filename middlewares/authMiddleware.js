import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    const token = req.cookie.token;

    if (!token) {
      return res.redirect("/login");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    return res.redirect("/login");
  }
};