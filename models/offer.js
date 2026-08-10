import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage"
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0
    },
    targetType: {
      type: String,
      enum: ["product", "category", "referral"],
      required: true
    },
    productTarget: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null
    },
    categoryTarget: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    referralReward: {
      referrerAmount: { type: Number, default: 0 },
      refereeAmount: { type: Number, default: 0 }
    },
    expiryDate: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Offer", offerSchema);