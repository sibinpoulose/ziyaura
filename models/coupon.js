import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0
    },
    minPurchase: {
      type: Number,
      default: 0
    },
    maxDiscount: {
      type: Number,
      default: null
    },
    expiryDate: {
      type: Date,
      required: true
    },
    usageLimit: {
      type: Number,
      default: null
    },
    usedCount: {
      type: Number,
      default: 0
    },
    usersUsed: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Coupon", couponSchema);