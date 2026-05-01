import { registerUser, loginUser, sendOtp, verifyOtp,resetPassword as resetPasswordService } from "../services/authService.js";

export const signup = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.render("signup", { message: "All fields are required", user: null });
    }

    if (password !== confirmPassword) {
      return res.render("signup", { message: "Passwords do not match", user: null });
    }

    await registerUser({ name, email, password, phone });

    await sendOtp(email);

    res.render("otp", { email, message: null });

  } catch (err) {
    res.render("signup", { message: err.message, user: null });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", { message: "All fields are required" });
    }

    const data = await loginUser(req.body);
    res.cookie("token", data.token, {
      httpOnly: true,
    })

    res.redirect("/home");

  } catch (err) {
    res.render("login", { message: err.message });
  }
};

export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    await sendOtp(email);

    res.render("otp", { email, message: null });

  } catch (err) {
    res.render("login", { message: err.message });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    await verifyOtp(email, otp);

    res.redirect("/login");

  } catch (err) {
    res.render("otp", {
      email: req.body.email,
      message: err.message
    });
  }
};
export const logout = (req, res) => {
  res.clearCookie("token");
  res.redirect("/login")
}


export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    await sendOtp(email); 

    res.render("verify-otp", {
      email,
      message: "OTP sent to your email"
    });

  } catch (err) {
    res.render("forgot-password", {
      message: err.message
    });
  }
};
export const verifyOtpReset = async (req, res) => {
  try {
    const { email, otp } = req.body;

    await verifyOtp(email, otp); 

    
    res.render("reset-password", {
      email,
      message: ""
    });

  } catch (err) {
    res.render("verify-otp", {
      email: req.body.email,
      message: err.message
    });
  }
};
export const resetPassword = async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.render("reset-password", {
        email,
        message: "All fields required"
      });
    }

    if (password !== confirmPassword) {
      return res.render("reset-password", {
        email,
        message: "Passwords do not match"
      });
    }

    await resetPasswordService(email, password);

    res.redirect("/login");

  } catch (err) {
    res.render("reset-password", {
      email: req.body.email,
      message: err.message
    });
  }
};