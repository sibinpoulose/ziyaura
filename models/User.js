import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
        },

        phone: {
            type: String,
        },
        profileImage: {

            type: String,

            default: ""

        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },

        isBlocked: {
            type: Boolean,
            default: false,
        },
        otp: {
            type: String,
        },

        otpExpiry: {
            type: Date,
        },

        isVerified: {
            type: Boolean,
            default: false,
        },
        walletBalance: {
            type: Number,
            default: 0
        },
        referralCode: {
            type: String,
            unique: true,
            sparse: true,
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);