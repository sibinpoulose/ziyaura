import User from "../models/User.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { generateOTP } from "../utils/otp.js";
import jwt from "jsonwebtoken";
import { sendMail } from "../utils/mail.js";

export const registerUser = async (data) => {
  const { name, email, password, phone } = data;

  const existing = await User.findOne({ email });
  if (existing) throw new Error("User already exists");

  const hashedPassword = await hashPassword(password);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    phone,
  });

  const userObj = user.toObject();
  delete userObj.password;

  return userObj;
};

export const loginUser = async (data) => {
  const { email, password } = data;

  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  if (!user.isVerified) throw new Error("Please verify OTP first");

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) throw new Error("Invalid password");

  if (user.isBlocked) throw new Error("User is blocked");

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  const userObj = user.toObject();
  delete userObj.password;

  return { user: userObj, token };
};

export const sendOtp = async (email) => {
  const user = await User.findOne({ email });

  if (!user) throw new Error("User not found");

  const otp = generateOTP();

  user.otp = otp;
  user.otpExpiry = Date.now() + 5 * 60 * 1000;
  user.isVerified = false;

  await user.save();
  await sendMail(email,otp)

  console.log("OTP:", otp);

  return { message: "OTP sent" };
};

export const verifyOtp = async (email, otp) => {
  const user = await User.findOne({ email });

  if (!user) throw new Error("User not found");

  if (user.otp !== otp) throw new Error("Invalid OTP");

  if (user.otpExpiry < Date.now()) {
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    throw new Error("OTP expired");
  }

  user.isVerified = true;
  user.otp = null;
  user.otpExpiry = null;

  await user.save();

  return { message: "OTP verified" };
};