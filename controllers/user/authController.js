import {
  registerUser,
  loginUser,
  sendOtp,
  verifyOtp,
  resetPassword as resetPasswordService
}
  from "../../services/authService.js";

import User from "../../models/User.js";


// SIGNUP
export const signup = async (req, res) => {

  try {

    const {
      name,
      email,
      password,
      confirmPassword,
      phone
    } = req.body;


    // EMPTY CHECK

    if (
      !name ||
      !email ||
      !password ||
      !confirmPassword
    ) {

      req.session.error =
        "All fields are required";

      return res.redirect("/signup");

    }


    // PASSWORD MATCH

    if (password !== confirmPassword) {

      req.session.error =
        "Passwords do not match";

      return res.redirect("/signup");

    }


    // REGISTER USER

    await registerUser({

      name,
      email,
      password,
      phone

    });


    // SEND OTP

    await sendOtp(email);


    req.session.success =
      "OTP sent successfully";


    res.render("user/otp", {

      email

    });

  }

  catch (err) {

    req.session.error =
      err.message;

    res.redirect("/signup");

  }

};


// LOGIN
export const login = async (req, res) => {

  try {

    const { email, password } = req.body;


    // EMPTY CHECK

    if (!email || !password) {

      req.session.error =
        "All fields are required";

      return res.redirect("/login");

    }


    // LOGIN USER

    const data =
      await loginUser(req.body);


    // TOKEN COOKIE

    res.cookie(

      "token",

      data.token,

      {

        httpOnly: true,

        maxAge:
          24 * 60 * 60 * 1000

      }

    );


    // SUCCESS MESSAGE

    req.session.success =
      "Login successful";


    // ADMIN LOGIN

    if (data.user.role === "admin") {

      return res.redirect(
        "/admin/dashboard"
      );

    }


    // USER LOGIN

    res.redirect("/home");

  }

  catch (err) {

    req.session.error =
      err.message;

    res.redirect("/login");

  }

};


// SEND OTP
export const sendOTP = async (req, res) => {

  try {

    const { email } = req.body;


    await sendOtp(email);


    req.session.success =
      "OTP sent successfully";


    res.render("user/otp", {

      email

    });

  }

  catch (err) {

    req.session.error =
      err.message;

    res.redirect("/login");

  }

};


// VERIFY OTP
export const verifyOTP = async (req, res) => {

  try {

    const { email, otp } = req.body;


    await verifyOtp(email, otp);


    req.session.success =
      "Account verified successfully";


    res.redirect("/login");

  }

  catch (err) {

    req.session.error =
      err.message;

    res.render("user/otp", {

      email: req.body.email

    });

  }

};


// LOGOUT
export const logout = (req, res) => {

  res.clearCookie("token");


  req.session.success =
    "Logged out successfully";


  res.redirect("/login");

};


// FORGOT PASSWORD
export const forgotPassword = async (req, res) => {

  try {

    const { email } = req.body;


    await sendOtp(email);


    req.session.success =
      "OTP sent to your email";


    res.render("user/verify-otp", {

      email

    });

  }

  catch (err) {

    req.session.error =
      err.message;

    res.redirect("/forgot-password");

  }

};


// VERIFY RESET OTP
export const verifyOtpReset = async (req, res) => {

  try {

    const { email, otp } = req.body;


    await verifyOtp(email, otp);


    req.session.success =
      "OTP verified successfully";


    res.render("user/reset-password", {

      email

    });

  }

  catch (err) {

    req.session.error =
      err.message;

    res.render("user/verify-otp", {

      email: req.body.email

    });

  }

};


// RESET PASSWORD
export const resetPassword = async (req, res) => {

  try {

    const {
      email,
      password,
      confirmPassword
    } = req.body;


    // EMPTY CHECK

    if (!password || !confirmPassword) {

      req.session.error =
        "All fields are required";

      return res.render(
        "user/reset-password",
        { email }
      );

    }


    // PASSWORD MATCH

    if (password !== confirmPassword) {

      req.session.error =
        "Passwords do not match";

      return res.render(
        "user/reset-password",
        { email }
      );

    }


    // RESET PASSWORD

    await resetPasswordService(
      email,
      password
    );


    req.session.success =
      "Password reset successful";


    res.redirect("/login");

  }

  catch (err) {

    req.session.error =
      err.message;

    res.render("user/reset-password", {

      email: req.body.email

    });

  }

};