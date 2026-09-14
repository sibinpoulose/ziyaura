import User from "../../models/User.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import { generateOTP } from "../../utils/otp.js";
import jwt from "jsonwebtoken";
import { sendMail } from "../../utils/mail.js";

export const registerUser = async (data) => {
  const { name, email, password, phone } = data;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    if (existingUser.isVerified) {
      throw new Error("User already exists with this email address. Please login.");
    }

    const hashedPassword = await hashPassword(password);
    existingUser.name = name;
    existingUser.password = hashedPassword;
    if (phone) existingUser.phone = phone;

    await existingUser.save();

    const userObj = existingUser.toObject();
    delete userObj.password;
    return userObj;
  }

  const hashedPassword = await hashPassword(password);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    phone
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

  try {
    await sendMail(email, otp);
  } catch (err) {
    console.error("Failed to send OTP email:", err);
  }

  return { message: "OTP sent" };
};

export const verifyOtp = async (email, otp) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  if (user.otp !== otp) throw new Error("Invalid OTP");

  if (user.otpExpiry < Date.now()) throw new Error("OTP expired");

  user.isVerified = true;
  user.otp = null;
  user.otpExpiry = null;

  await user.save();
  return user;
};

export const getOtpTimeRemaining = async (email) => {
  if (!email) return 0;
  const user = await User.findOne({ email }).select("otpExpiry");
  if (!user || !user.otpExpiry) return 0;
  return Math.max(0, Math.floor((user.otpExpiry.getTime() - Date.now()) / 1000));
};

export const resetPassword = async (email, newPassword) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  if (!user.isVerified) throw new Error("OTP not verified");

  const hashedPassword = await hashPassword(newPassword);
  user.password = hashedPassword;
  await user.save();

  return { message: "Password updated" };
};
