import Cart from "../../models/Cart.js";
import Order from "../../models/order.js";
import Product from "../../models/product.js";
import Address from "../../models/address.js";
import Coupon from "../../models/coupon.js";
import User from "../../models/User.js";
import WalletTransaction from "../../models/walletTransaction.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "secret_placeholder"
});

export const getCheckoutPageData = async (userId, couponCodeSession = null) => {
  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    populate: { path: "category" }
  });

  if (!cart || cart.items.length === 0) {
    return { error: "Your shopping bag is empty", redirectUrl: "/cart" };
  }

  for (const item of cart.items) {
    const product = item.productId;
    if (!product || product.isDeleted || !product.isListed || !product.category || !product.category.isListed) {
      return {
        error: "Some items in your shopping bag are unlisted or no longer available. Please resolve them before checkout.",
        redirectUrl: "/cart"
      };
    }

    if (item.variantId) {
      const variant = product.variants.id(item.variantId);
      if (!variant || !variant.isListed) {
        return {
          error: "Selected option for an item in your shopping bag is unlisted. Please resolve them before checkout.",
          redirectUrl: "/cart"
        };
      }
    }
  }

  const [addresses, userDetails, availableCoupons] = await Promise.all([
    Address.find({ userId }).lean(),
    User.findById(userId).select("walletBalance").lean(),
    Coupon.find({ isActive: true, expiryDate: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean()
  ]);

  const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0];

  const checkoutItems = [];
  let subtotal = 0;

  for (const item of cart.items) {
    const product = item.productId;
    let price = product.salePrice ?? product.price;
    let image = product.images && product.images[0] ? product.images[0] : "/images/placeholder.jpg";
    let variantDetails = "";

    if (item.variantId) {
      const variant = product.variants.id(item.variantId);
      price = variant.salePrice ?? variant.price;
      variantDetails = variant.combination.map((n) => `${n.name}:${n.value}`).join("|");
    }

    const itemTotal = price * item.quantity;
    subtotal += itemTotal;

    checkoutItems.push({
      productId: product._id,
      variantId: item.variantId || null,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      image,
      quantity: item.quantity,
      price,
      itemTotal,
      variantDetails
    });
  }

  const shippingCharge = subtotal > 50000 || subtotal === 0 ? 0 : 50;

  let couponDiscount = 0;
  let couponCode = couponCodeSession;
  let appliedCoupon = null;

  if (couponCode) {
    appliedCoupon = await Coupon.findOne({ code: couponCode, isActive: true });
    if (appliedCoupon && new Date() <= appliedCoupon.expiryDate && subtotal >= appliedCoupon.minPurchase) {
      if (appliedCoupon.discountType === "percentage") {
        couponDiscount = (subtotal * appliedCoupon.discountValue) / 100;
        if (appliedCoupon.maxDiscount && couponDiscount > appliedCoupon.maxDiscount) {
          couponDiscount = appliedCoupon.maxDiscount;
        }
      } else {
        couponDiscount = appliedCoupon.discountValue;
      }
    } else {
      couponCode = null;
    }
  }

  const grandTotal = Math.max(0, subtotal + shippingCharge - couponDiscount);

  return {
    checkoutItems,
    addresses,
    defaultAddress,
    subtotal,
    shippingCharge,
    discount: couponDiscount,
    couponCode,
    walletBalance: userDetails?.walletBalance || 0,
    grandTotal,
    availableCoupons
  };
};

export const placeUserOrderService = async ({ userId, userObj, addressId, paymentMethod, couponCode }) => {
  if (!addressId) {
    return { error: "Please select a shipping address." };
  }

  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    populate: { path: "category" }
  });

  if (!cart || cart.items.length === 0) {
    return { error: "Your shopping bag is empty." };
  }

  const addressDoc = await Address.findOne({ _id: addressId, userId });
  if (!addressDoc) {
    return { error: "Invalid shipping address selected." };
  }

  const orderProducts = [];
  let subtotal = 0;

  for (const item of cart.items) {
    const prod = item.productId;
    if (!prod || prod.isDeleted || !prod.isListed || !prod.category || !prod.category.isListed) {
      return { error: `Product "${prod?.name || "Unknown"}" is unlisted or no longer available.` };
    }

    let price = prod.salePrice ?? prod.price;
    let sku = prod.sku;
    let variantDetails = "";
    let targetStock = prod.stock;

    if (item.variantId) {
      const variant = prod.variants.id(item.variantId);
      if (!variant || !variant.isListed) {
        return { error: `Selected option for "${prod.name}" is unlisted or unavailable.` };
      }
      price = variant.salePrice ?? variant.price;
      sku = variant.sku;
      targetStock = variant.stock;
      variantDetails = variant.combination.map((c) => `${c.name}: ${c.value}`).join(" | ");
    }

    if (targetStock < item.quantity) {
      return { error: `Insufficient stock for "${prod.name}". Only ${targetStock} left.` };
    }

    const itemTotal = price * item.quantity;
    subtotal += itemTotal;

    orderProducts.push({
      productId: prod._id,
      variantId: item.variantId || null,
      name: prod.name,
      image: prod.images && prod.images[0] ? prod.images[0] : "/images/placeholder.jpg",
      sku,
      variantDetails,
      price,
      quantity: item.quantity,
      total: itemTotal,
      orderStatus: "Pending"
    });
  }

  const shippingCharge = subtotal > 50000 ? 0 : 50;

  let couponDiscount = 0;
  let validCoupon = null;
  if (couponCode) {
    validCoupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    if (validCoupon && new Date() <= validCoupon.expiryDate && subtotal >= validCoupon.minPurchase) {
      const hasUsed = validCoupon.usersUsed.includes(userId);
      if (!hasUsed) {
        if (validCoupon.discountType === "percentage") {
          couponDiscount = (subtotal * validCoupon.discountValue) / 100;
          if (validCoupon.maxDiscount && couponDiscount > validCoupon.maxDiscount) {
            couponDiscount = validCoupon.maxDiscount;
          }
        } else {
          couponDiscount = validCoupon.discountValue;
        }
      }
    }
  }

  const grandTotal = Math.max(0, subtotal + shippingCharge - couponDiscount);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderId = `ORD-${dateStr}-${randomSuffix}`;

  if (paymentMethod === "WALLET") {
    const user = await User.findById(userId);
    if (!user || user.walletBalance < grandTotal) {
      return { error: "Insufficient wallet balance." };
    }

    user.walletBalance -= grandTotal;
    await user.save();

    await WalletTransaction.create({
      userId,
      amount: grandTotal,
      type: "debit",
      description: `Order placement using wallet: ${orderId}`,
      orderId
    });
  }

  if (paymentMethod !== "ONLINE") {
    for (const item of cart.items) {
      const prod = await Product.findById(item.productId._id);
      if (prod) {
        if (item.variantId) {
          const v = prod.variants.id(item.variantId);
          if (v) v.stock -= item.quantity;
        } else {
          prod.stock -= item.quantity;
        }
        await prod.save();
      }
    }
  }

  const newOrder = await Order.create({
    orderId,
    userId,
    shippingAddress: {
      addressId: addressDoc._id,
      fullName: addressDoc.fullName,
      address: addressDoc.address,
      phone: addressDoc.phone,
      landmark: addressDoc.landmark || "",
      city: addressDoc.city,
      state: addressDoc.state,
      pincode: addressDoc.pincode,
      addressType: addressDoc.addressType
    },
    products: orderProducts,
    subtotal,
    shippingCharge,
    discount: couponDiscount,
    couponCode: validCoupon ? validCoupon.code : null,
    couponDiscount,
    grandTotal,
    paymentMethod: paymentMethod || "COD",
    paymentStatus: paymentMethod === "WALLET" ? "Paid" : "Pending",
    orderStatus: "Pending"
  });

  if (validCoupon) {
    validCoupon.usersUsed.push(userId);
    validCoupon.usedCount += 1;
    await validCoupon.save();
  }

  if (paymentMethod === "ONLINE") {
    const options = {
      amount: Math.round(grandTotal * 100),
      currency: "INR",
      receipt: orderId
    };

    const rzpOrder = await razorpay.orders.create(options);
    newOrder.razorpayOrderId = rzpOrder.id;
    await newOrder.save();

    cart.items = [];
    await cart.save();

    return {
      success: true,
      paymentNeeded: true,
      razorpayOrderId: rzpOrder.id,
      amount: options.amount,
      key_id: process.env.RAZORPAY_KEY_ID,
      orderId: newOrder._id,
      user: {
        name: userObj.name,
        email: userObj.email,
        phone: userObj.phone || "9999999999"
      }
    };
  }

  cart.items = [];
  await cart.save();

  return { success: true, orderId: newOrder._id };
};

export const verifyRazorpayPaymentService = async ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  orderId
}) => {
  const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "secret_placeholder");
  hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
  const generated_signature = hmac.digest("hex");

  const orderDoc = await Order.findById(orderId);
  if (!orderDoc) {
    return { error: "Order records not found.", notFound: true };
  }

  if (generated_signature === razorpay_signature) {
    orderDoc.paymentStatus = "Paid";
    orderDoc.razorpayPaymentId = razorpay_payment_id;
    await orderDoc.save();

    for (const item of orderDoc.products) {
      const prod = await Product.findById(item.productId);
      if (prod) {
        if (item.variantId) {
          const v = prod.variants.id(item.variantId);
          if (v) v.stock -= item.quantity;
        } else {
          prod.stock -= item.quantity;
        }
        await prod.save();
      }
    }

    return { success: true };
  }

  orderDoc.paymentStatus = "Failed";
  await orderDoc.save();
  return { error: "Signature verification failed." };
};

export const markPaymentAsFailed = async (orderId) => {
  const orderDoc = await Order.findById(orderId);
  if (orderDoc) {
    orderDoc.paymentStatus = "Failed";
    await orderDoc.save();
  }
};

export const getOrderSuccessData = async (orderId, userId) => {
  return await Order.findOne({ _id: orderId, userId }).lean();
};

export const initiateRepaymentService = async (orderId, userId, userObj) => {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) {
    return { error: "Order not found.", notFound: true };
  }

  if (order.paymentStatus === "Paid") {
    return { error: "This order is already paid." };
  }

  const options = {
    amount: Math.round(order.grandTotal * 100),
    currency: "INR",
    receipt: order.orderId
  };

  const rzpOrder = await razorpay.orders.create(options);
  order.razorpayOrderId = rzpOrder.id;
  await order.save();

  return {
    success: true,
    key_id: process.env.RAZORPAY_KEY_ID,
    amount: options.amount,
    razorpayOrderId: rzpOrder.id,
    orderId: order._id,
    user: {
      name: userObj.name,
      email: userObj.email,
      phone: userObj.phone || "9999999999"
    }
  };
};
