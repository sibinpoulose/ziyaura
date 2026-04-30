import { registerUser, loginUser, sendOtp, verifyOtp } from "../services/authService.js";

export const signup = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.render("signup", { message: "All fields are required" });
    }

    await registerUser(req.body);

    await sendOtp(email);

    res.render("otp", { email, message: null });

  } catch (err) {
    res.render("signup", { message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", { message: "All fields are required" });
    }

    const data = await loginUser(req.body);
    res.cookie("token",data.token,{
      httpOnly:true,
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

    res.redirect("/home");

  } catch (err) {
    res.render("otp", {
      email: req.body.email,
      message: err.message
    });
  }
};
export const logout=(req,res)=>{
  res.clearCookie("token");
  res.redirect("/login")
}