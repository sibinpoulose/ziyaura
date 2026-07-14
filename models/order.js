import mongoose from "mongoose";
const orderProductSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  sku: {
    type: String,
    default: ""
  },
  variantDetails: {
    type: String,
    default: ""
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  total: {
    type: Number,
    required: true
  },
  orderStatus: {
    type: String,
    enum: [
      "Pending",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Returned"
    ],
    default: "Pending"
  },
  cancelReason: {
    type: String,
    default: ""
  },
  returnReason: {
    type: String,
    default: ""
  }
});
const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    shippingAddress: {
      addressId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address",
        default: null
      },
      fullName: {
        type: String,
        required: true
      },
      address: {
        type: String,
        required: true
      },
      phone: {
        type: String,
        required: true
      },
      landmark: {
        type: String,
        default: ""
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      pincode: {
        type: String,
        required: true
      },
      addressType: {
        type: String,
        default: "Home"
      }
    },
    products: [orderProductSchema],
    subtotal: {
      type: Number,
      required: true
    },
    shippingCharge: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    grandTotal: {
      type: Number,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE", "WALLET"],
      default: "COD"
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending"
    },
    orderStatus: {
      type: String,
      enum: [
        "Pending",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled"
      ],
      default: "Pending"
    }
  },
  {
    timestamps: true
  }
);
export default mongoose.model("Order", orderSchema);
