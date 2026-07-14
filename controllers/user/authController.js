import {
  registerUser,
  loginUser,
  sendOtp,
  verifyOtp,
  resetPassword as resetPasswordService
} from "../../services/user/authService.js";

import User from "../../models/User.js";
import Category from "../../models/category.js";

export const signup = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      req.session.error = "All fields are required";
      return res.redirect("/signup");
    }

    // Name Validation (3-50 chars, only letters and spaces)
    const nameTrimmed = name.trim();
    if (nameTrimmed.length < 3 || nameTrimmed.length > 50 || !/^[A-Za-z\s]+$/.test(nameTrimmed)) {
      req.session.error = "Username must be 3-50 characters and contain only letters and spaces";
      return res.redirect("/signup");
    }

    // Email Validation
    const emailRegex = /^[^ ]+@[^ ]+\.[a-z]{2,3}$/;
    if (!email.match(emailRegex)) {
      req.session.error = "Please enter a valid email address";
      return res.redirect("/signup");
    }

    // Password strength check (8+ chars, upper, lower, number, special char)
    if (password.length < 8) {
      req.session.error = "Password must be at least 8 characters long";
      return res.redirect("/signup");
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      req.session.error = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character";
      return res.redirect("/signup");
    }

    if (password !== confirmPassword) {
      req.session.error = "Passwords do not match";
      return res.redirect("/signup");
    }

    // Phone Validation (10 digits if provided)
    if (phone && !/^[0-9]{10}$/.test(phone)) {
      req.session.error = "Phone number must be exactly 10 digits";
      return res.redirect("/signup");
    }

    await registerUser({
      name: nameTrimmed,
      email,
      password,
      phone
    });

    await sendOtp(email);

    req.session.success = "OTP sent successfully";
    req.session.email = email;
    res.redirect("/otp");
  } catch (err) {
    req.session.error = err.message;
    res.redirect("/signup");
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.session.error = "All fields are required";

      return res.redirect("/login");
    }

    const data = await loginUser(req.body);

    res.cookie(
      "userToken",

      data.token,

      {
        httpOnly: true,

        maxAge: 24 * 60 * 60 * 1000
      }
    );

    req.session.success = "Login successful";

    res.redirect("/home");
  } catch (err) {
    req.session.error = err.message;

    res.redirect("/login");
  }
};

export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    await sendOtp(email);

    req.session.success = "OTP sent successfully";

    const user = await User.findOne({ email });
    const timeLeft = user && user.otpExpiry ? Math.max(0, Math.floor((user.otpExpiry.getTime() - Date.now()) / 1000)) : 300;

    res.render("user/otp", {
      email,
      timeLeft
    });
  } catch (err) {
    req.session.error = err.message;

    res.redirect("/login");
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    await verifyOtp(email, otp);

    req.session.success = "Account verified successfully";

    res.redirect("/login");
  } catch (err) {
    const user = await User.findOne({ email: req.body.email });
    const timeLeft = user && user.otpExpiry ? Math.max(0, Math.floor((user.otpExpiry.getTime() - Date.now()) / 1000)) : 0;

    res.render("user/otp", {
      email: req.body.email,
      error: err.message,
      timeLeft
    });
  }
};

export const logout = (req, res) => {
  res.clearCookie("userToken");
  res.clearCookie("token");

  req.session.success = "Logged out successfully";

  res.redirect("/login");
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    await sendOtp(email);

    req.session.success = "OTP sent to your email";

    const user = await User.findOne({ email });
    const timeLeft = user && user.otpExpiry ? Math.max(0, Math.floor((user.otpExpiry.getTime() - Date.now()) / 1000)) : 300;

    res.render("user/verify-otp", {
      email,
      timeLeft
    });
  } catch (err) {
    req.session.error = err.message;

    res.redirect("/forgot-password");
  }
};
export const verifyOtpReset = async (req, res) => {
  const { email, otp } = req.body;

  try {

    await verifyOtp(email, otp);

    return res.render("user/reset-password", {
      email
    });

  } catch (err) {
    const user = await User.findOne({ email });
    const timeLeft = user && user.otpExpiry ? Math.max(0, Math.floor((user.otpExpiry.getTime() - Date.now()) / 1000)) : 0;

    return res.status(400).render(
      "user/verify-otp",
      {
        email,
        error: err.message,
        timeLeft
      }
    );

  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      req.session.error = "All fields are required";

      return res.render("user/reset-password", { email });
    }

    if (password !== confirmPassword) {
      req.session.error = "Passwords do not match";

      return res.render("user/reset-password", { email });
    }

    await resetPasswordService(email, password);

    req.session.success = "Password reset successful";

    res.redirect("/login");
  } catch (err) {
    req.session.error = err.message;

    res.render("user/reset-password", {
      email: req.body.email
    });
  }
};

export const redirectToHome = (req, res) => {
  res.redirect("/home");
};

export const loadLoginPage = (req, res) => {
  res.render("user/login");
};

export const loadSignupPage = (req, res) => {
  res.render("user/signup");
};

export const loadOtpPage = async (req, res) => {
  try {
    const email = req.session.email;
    if (!email) {
      return res.redirect("/signup");
    }
    const user = await User.findOne({ email });
    const timeLeft = user && user.otpExpiry ? Math.max(0, Math.floor((user.otpExpiry.getTime() - Date.now()) / 1000)) : 0;
    res.render("user/otp", {
      email,
      timeLeft
    });
  } catch (err) {
    req.session.error = err.message;
    res.redirect("/signup");
  }
};

export const loadHomePage = async (req, res) => {
  try {
    let featuredCategories = await Category.find({ isListed: true, isFeatured: true }).limit(4);
    
    // Fallback: if less than 4 are featured, fill with standard listed categories
    if (featuredCategories.length < 4) {
      const remaining = 4 - featuredCategories.length;
      const featuredIds = featuredCategories.map(c => c._id);
      const extraCategories = await Category.find({
        isListed: true,
        _id: { $not: { $in: featuredIds } }
      }).limit(remaining);
      featuredCategories = [...featuredCategories, ...extraCategories];
    }
    
    res.render("user/home", { featuredCategories });
  } catch (error) {
    console.error("Load Home Page Categories Error:", error);
    res.render("user/home", { featuredCategories: [] });
  }
};

export const loadForgotPasswordPage = (req, res) => {
  res.render("user/forgot-password");
};

export const handleGoogleCallback = (req, res) => {
  res.cookie(
    "userToken",
    req.user.token,
    {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  );
  res.redirect("/home");
};
