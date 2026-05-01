import jwt from "jsonwebtoken";

export const attachUser = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } else {
      req.user = null;
    }

  } catch (err) {
    req.user = null;
  }

  next();
};