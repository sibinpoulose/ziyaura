import Cart from "../../models/Cart.js";
import Order from "../../models/order.js";
import Product from "../../models/product.js";
import Address from "../../models/address.js";
import Coupon from "../../models/coupon.js";
import User from "../../models/User.js";
import WalletTransaction from "../../models/walletTransaction.js";
import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "secret_placeholder"
});

export const loadCheckoutPage = async (req, res) => {
  try {
    const cart = await Cart.findOne({
      userId: req.user._id
    }).populate({
      path: "items.productId",
      populate: {
        path: "category"
      }
    });

    if (!cart || cart.items.length === 0) {
      req.session.error = "Your shopping bag is empty";
      return res.redirect("/cart");
    }

    // SERVER GUARD: Block checkout if any cart item is unlisted or invalid
    for (let item of cart.items) {
      const product = item.productId;
      if (!product || product.isDeleted || !product.isListed || !product.category || !product.category.isListed) {
        req.session.error = "Some items in your shopping bag are unlisted or no longer available. Please resolve them before checkout.";
        return res.redirect("/cart");
      }

      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant || !variant.isListed) {
          req.session.error = "Selected option for an item in your shopping bag is unlisted. Please resolve them before checkout.";
          return res.redirect("/cart");
        }
      }
    }

    const addresses = await Address.find({
      userId: req.user._id
    });
    const defaultAddress = addresses.find(address => address.isDefault) || addresses[0];
    
    // Fetch user details for wallet balance
    const userDetails = await User.findById(req.user._id);

    const checkoutItems = [];
    let subtotal = 0;

    for (let item of cart.items) {
      const product = item.productId;
      let price = product.salePrice ?? product.price;
      let image = product.images && product.images[0] ? product.images[0] : "/images/placeholder.jpg";
      let variantDetails = "";

      if (item.variantId) {
        let variant = product.variants.id(item.variantId);
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
    
    // Check coupon in session
    let couponDiscount = 0;
    let couponCode = req.session.couponCode || null;
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
        delete req.session.couponCode;
        couponCode = null;
      }
    }

    const grandTotal = Math.max(0, subtotal + shippingCharge - couponDiscount);

    // Fetch available active coupons for display
    const availableCoupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.render("user/checkout", {
      checkoutItems,
      addresses,
      defaultAddress,
      subtotal,
      shippingCharge,
      discount: couponDiscount,
      couponCode,
      walletBalance: userDetails.walletBalance || 0,
      grandTotal,
      availableCoupons
    });
  } catch (error) {
    console.error(error);
    req.session.error = "Unable to load checkout";
    res.redirect("/cart");
  }
};

export const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    if (!addressId) {
      return res.status(400).json({ success: false, message: "Please select a shipping address." });
    }

    const cart = await Cart.findOne({ userId: req.user._id }).populate({
      path: "items.productId",
      populate: { path: "category" }
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Your shopping bag is empty." });
    }

    const addressDoc = await Address.findOne({ _id: addressId, userId: req.user._id });
    if (!addressDoc) {
      return res.status(400).json({ success: false, message: "Invalid shipping address selected." });
    }

    const orderProducts = [];
    let subtotal = 0;

    for (const item of cart.items) {
      const prod = item.productId;
      if (!prod || prod.isDeleted || !prod.isListed || !prod.category || !prod.category.isListed) {
        return res.status(400).json({ success: false, message: `Product "${prod?.name || 'Unknown'}" is unlisted or no longer available.` });
      }

      let price = prod.salePrice ?? prod.price;
      let sku = prod.sku;
      let variantDetails = "";
      let targetStock = prod.stock;

      // Handle Variant stock & listing validation
      if (item.variantId) {
        const variant = prod.variants.id(item.variantId);
        if (!variant || !variant.isListed) {
          return res.status(400).json({ success: false, message: `Selected option for "${prod.name}" is unlisted or unavailable.` });
        }
        price = variant.salePrice ?? variant.price;
        sku = variant.sku;
        targetStock = variant.stock;
        variantDetails = variant.combination.map(c => `${c.name}: ${c.value}`).join(" | ");
      }

      if (targetStock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for "${prod.name}". Only ${targetStock} left.` });
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
    
    // Coupon Application
    let couponDiscount = 0;
    let validCoupon = null;
    if (couponCode) {
      validCoupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (validCoupon && new Date() <= validCoupon.expiryDate && subtotal >= validCoupon.minPurchase) {
        const hasUsed = validCoupon.usersUsed.includes(req.user._id);
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

    // Wallet transaction check
    if (paymentMethod === "WALLET") {
      const user = await User.findById(req.user._id);
      if (user.walletBalance < grandTotal) {
        return res.status(400).json({ success: false, message: "Insufficient wallet balance." });
      }

      // Deduct wallet
      user.walletBalance -= grandTotal;
      await user.save();

      // Log wallet transaction
      await WalletTransaction.create({
        userId: req.user._id,
        amount: grandTotal,
        type: "debit",
        description: `Order placement using wallet: ${orderId}`,
        orderId
      });
    }

    // STOCK DEDUCTION RULE: Deduct stock ONLY for COD & WALLET.
    // For ONLINE payments, defer stock deduction to verifyRazorpayPayment when payment passes!
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
      userId: req.user._id,
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
      validCoupon.usersUsed.push(req.user._id);
      validCoupon.usedCount += 1;
      await validCoupon.save();
      delete req.session.couponCode; // clean session
    }

    // ONLINE PAYMENT GATEWAY (Razorpay)
    if (paymentMethod === "ONLINE") {
      const options = {
        amount: Math.round(grandTotal * 100), // paise
        currency: "INR",
        receipt: orderId
      };
      
      const rzpOrder = await razorpay.orders.create(options);
      newOrder.razorpayOrderId = rzpOrder.id;
      await newOrder.save();

      // Clear cart
      cart.items = [];
      await cart.save();

      return res.status(200).json({
        success: true,
        paymentNeeded: true,
        razorpayOrderId: rzpOrder.id,
        amount: options.amount,
        key_id: process.env.RAZORPAY_KEY_ID,
        orderId: newOrder._id,
        user: {
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone || "9999999999"
        }
      });
    }

    // Clear cart immediately for COD and WALLET orders
    cart.items = [];
    await cart.save();

    return res.status(200).json({ success: true, orderId: newOrder._id });
  } catch (error) {
    console.error("Place Order Error:", error);
    return res.status(500).json({ success: false, message: "Failed to place order. Please try again." });
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "secret_placeholder");
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");

    const orderDoc = await Order.findById(orderId);
    if (!orderDoc) {
      return res.status(404).json({ success: false, message: "Order records not found." });
    }

    if (generated_signature === razorpay_signature) {
      orderDoc.paymentStatus = "Paid";
      orderDoc.razorpayPaymentId = razorpay_payment_id;
      await orderDoc.save();

      // DEDUCT STOCK NOW since online payment succeeded!
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

      return res.status(200).json({ success: true, message: "Payment verified successfully." });
    } else {
      orderDoc.paymentStatus = "Failed";
      await orderDoc.save();
      return res.status(400).json({ success: false, message: "Signature verification failed." });
    }
  } catch (error) {
    console.error("Payment Verification Error:", error);
    res.status(500).json({ success: false, message: "Server error during verification." });
  }
};

export const handlePaymentFailure = async (req, res) => {
  try {
    const { orderId } = req.body;
    const orderDoc = await Order.findById(orderId);
    if (orderDoc) {
      orderDoc.paymentStatus = "Failed";
      await orderDoc.save();
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};

export const loadOrderSuccessPage = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id });
    if (!order) {
      req.session.error = "Order not found.";
      return res.redirect("/home");
    }
    res.render("user/order-success", { order });
  } catch (error) {
    console.error("Load Order Success Page Error:", error);
    res.redirect("/home");
  }
};

export const loadPaymentFailurePage = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id });
    if (!order) {
      req.session.error = "Order not found.";
      return res.redirect("/home");
    }
    res.render("user/payment-failure", { order });
  } catch (error) {
    console.error("Load Payment Failure Page Error:", error);
    res.redirect("/home");
  }
};

export const initiateRepayment = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.paymentStatus === "Paid") {
      return res.status(400).json({ success: false, message: "This order is already paid." });
    }

    // Generate a fresh Razorpay order key ID in case the previous transaction timed out
    const options = {
      amount: Math.round(order.grandTotal * 100),
      currency: "INR",
      receipt: order.orderId
    };

    const rzpOrder = await razorpay.orders.create(options);
    order.razorpayOrderId = rzpOrder.id;
    await order.save();

    return res.status(200).json({
      success: true,
      key_id: process.env.RAZORPAY_KEY_ID,
      amount: options.amount,
      razorpayOrderId: rzpOrder.id,
      orderId: order._id,
      user: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || "9999999999"
      }
    });
  } catch (error) {
    console.error("Initiate Repayment Error:", error);
    res.status(500).json({ success: false, message: "Failed to initiate repayment gateway." });
  }
};