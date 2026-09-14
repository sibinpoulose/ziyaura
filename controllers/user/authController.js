import passport from "../../config/passport.js";
import {
  registerUser,
  loginUser,
  sendOtp,
  verifyOtp,
  resetPassword as resetPasswordService,
  getOtpTimeRemaining
} from "../../services/user/authService.js";
import { handleReferralSignup, validateReferralCode } from "../../services/user/referralService.js";
import { getFeaturedCategoriesForHome } from "../../services/user/homeService.js";
import { COOKIE_MAX_AGE, HTTP_STATUS } from "../../utils/constants.js";

export const signup = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, referralCode } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      req.session.error = "All required fields must be filled";
      return res.redirect("/signup");
    }

    const nameTrimmed = name.trim();
    if (nameTrimmed.length < 3 || nameTrimmed.length > 50 || !/^[A-Za-z\s]+$/.test(nameTrimmed)) {
      req.session.error = "Username must be 3-50 characters and contain only letters and spaces";
      return res.redirect("/signup");
    }

    const emailRegex = /^[^ ]+@[^ ]+\.[a-z]{2,3}$/i;
    if (!email.match(emailRegex)) {
      req.session.error = "Please enter a valid email address";
      return res.redirect("/signup");
    }

    if (password.length < 8) {
      req.session.error = "Password must be at least 8 characters long";
      return res.redirect("/signup");
    }

    if (
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      req.session.error =
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character";
      return res.redirect("/signup");
    }

    if (password !== confirmPassword) {
      req.session.error = "Passwords do not match";
      return res.redirect("/signup");
    }

    if (phone && !/^[0-9]{10}$/.test(phone)) {
      req.session.error = "Phone number must be exactly 10 digits";
      return res.redirect("/signup");
    }

    if (referralCode && referralCode.trim()) {
      const referrer = await validateReferralCode(referralCode.trim());
      if (!referrer) {
        req.session.error = "Invalid referral code provided";
        return res.redirect("/signup");
      }
      req.session.referralCode = referralCode.trim();
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

    const { token } = await loginUser(req.body);

    res.cookie("userToken", token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE
    });

    req.session.success = "Login successful";
    res.redirect("/home");
  } catch (err) {
    if (err.message === "Please verify OTP first") {
      try {
        await sendOtp(req.body.email);
        req.session.email = req.body.email;
        req.session.success = "Please enter the OTP sent to your email to verify your account.";
        return res.redirect("/otp");
      } catch (otpErr) {
        req.session.error = "Could not send verification OTP. Please try signing up again.";
        return res.redirect("/login");
      }
    }

    req.session.error = err.message;
    res.redirect("/login");
  }
};

export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    await sendOtp(email);

    req.session.success = "OTP sent successfully";
    const timeLeft = await getOtpTimeRemaining(email);

    res.render("user/otp", {
      email,
      timeLeft: timeLeft || 300
    });
  } catch (err) {
    req.session.error = err.message;
    res.redirect("/login");
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await verifyOtp(email, otp);

    if (req.session.referralCode) {
      await handleReferralSignup(user._id, req.session.referralCode);
      delete req.session.referralCode;
    }

    req.session.success = "Account verified successfully";
    res.redirect("/login");
  } catch (err) {
    const timeLeft = await getOtpTimeRemaining(req.body.email);

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
    const timeLeft = await getOtpTimeRemaining(email);

    res.render("user/verify-otp", {
      email,
      timeLeft: timeLeft || 300
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
    const timeLeft = await getOtpTimeRemaining(email);

    return res.status(HTTP_STATUS.BAD_REQUEST).render("user/verify-otp", {
      email,
      error: err.message,
      timeLeft
    });
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
  const referralCode = req.query.ref || "";
  res.render("user/signup", { referralCode });
};

export const loadOtpPage = async (req, res) => {
  try {
    const email = req.session.email;
    if (!email) {
      return res.redirect("/signup");
    }
    const timeLeft = await getOtpTimeRemaining(email);
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
    const featuredCategories = await getFeaturedCategoriesForHome();
    res.render("user/home", { featuredCategories });
  } catch (error) {
    console.error("Load Home Page Categories Error:", error);
    res.render("user/home", { featuredCategories: [] });
  }
};

export const loadForgotPasswordPage = (req, res) => {
  res.render("user/forgot-password");
};

export const handleGoogleCallback = (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, data) => {
    if (err) {
      console.error("Google Auth Error:", err);
      req.session.error = "Google authentication failed: " + (err.message || "Unknown error");
      return res.redirect("/login");
    }

    if (!data || !data.token) {
      req.session.error = "Your account is blocked or Google authentication failed";
      return res.redirect("/login");
    }

    res.cookie("userToken", data.token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE
    });

    req.session.success = "Login successful";
    return res.redirect("/home");
  })(req, res, (err) => {
    console.error("Google Passport Execution Error:", err);
    req.session.error = "Google authentication failed. Please try again.";
    return res.redirect("/login");
  });
};
