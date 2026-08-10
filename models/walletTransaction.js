import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    orderId: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

export default mongoose.model("WalletTransaction", walletTransactionSchema);