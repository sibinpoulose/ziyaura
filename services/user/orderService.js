import Order from "../../models/order.js";
import Product from "../../models/product.js";
import User from "../../models/User.js";
import WalletTransaction from "../../models/walletTransaction.js";
import { recalculateOrderFinancials } from "../../utils/orderUtils.js";

export const getUserOrdersList = async ({ userId, page = 1, limit = 5, search = "" }) => {
  const skip = (page - 1) * limit;

  const filterQuery = { userId };

  if (search) {
    filterQuery.$or = [
      { orderId: { $regex: search, $options: "i" } },
      { "products.name": { $regex: search, $options: "i" } }
    ];
  }

  const [orders, totalOrders] = await Promise.all([
    Order.find(filterQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filterQuery)
  ]);

  const totalPages = Math.ceil(totalOrders / limit);

  return {
    orders,
    currentPage: page,
    totalPages,
    search
  };
};

export const getUserOrderDetail = async (orderId, userId) => {
  return await Order.findOne({ _id: orderId, userId });
};

export const cancelUserOrderService = async ({ orderId, userId, itemId, reason }) => {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) {
    return { error: "Order not found.", notFound: true };
  }

  if (order.orderStatus === "Delivered" || order.orderStatus === "Cancelled") {
    return { error: "Cannot cancel this order." };
  }

  if (itemId) {
    const item = order.products.id(itemId);
    if (!item) {
      return { error: "Item not found in order.", notFound: true };
    }

    if (["Cancelled", "Returned", "Return Requested"].includes(item.orderStatus)) {
      return { error: "Item is already cancelled or returned." };
    }

    item.orderStatus = "Cancelled";
    item.cancelReason = reason || "Cancelled by user";

    const product = await Product.findById(item.productId);
    if (product) {
      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (variant) variant.stock += item.quantity;
      } else {
        product.stock += item.quantity;
      }
      await product.save();
    }
  } else {
    order.orderStatus = "Cancelled";

    for (const item of order.products) {
      if (item.orderStatus !== "Cancelled") {
        item.orderStatus = "Cancelled";
        item.cancelReason = reason || "Cancelled by user";

        const product = await Product.findById(item.productId);
        if (product) {
          if (item.variantId) {
            const variant = product.variants.id(item.variantId);
            if (variant) variant.stock += item.quantity;
          } else {
            product.stock += item.quantity;
          }
          await product.save();
        }
      }
    }
  }

  const refundAmount = await recalculateOrderFinancials(order);

  if (refundAmount > 0) {
    const user = await User.findById(userId);
    if (user) {
      user.walletBalance = (user.walletBalance || 0) + refundAmount;
      await user.save();
    }

    await WalletTransaction.create({
      userId,
      amount: refundAmount,
      type: "credit",
      description: `Refund for Cancelled Order: ${order.orderId}`,
      orderId: order.orderId
    });

    order.paymentStatus = "Refunded";
  }

  await order.save();
  return { success: true, refundAmount };
};

export const requestOrderReturnService = async ({ orderId, userId, itemId, reason }) => {
  if (!reason || reason.trim() === "") {
    return { error: "Return reason is mandatory." };
  }

  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) {
    return { error: "Order not found.", notFound: true };
  }

  if (order.orderStatus !== "Delivered") {
    return { error: "Only delivered orders can be returned." };
  }

  if (itemId) {
    const item = order.products.id(itemId);
    if (!item) {
      return { error: "Item not found in order.", notFound: true };
    }

    if (item.orderStatus !== "Delivered") {
      return { error: "Only delivered items can be returned." };
    }

    item.orderStatus = "Return Requested";
    item.returnReason = reason;

    const allReturned = order.products.every((p) =>
      ["Return Requested", "Returned", "Cancelled"].includes(p.orderStatus)
    );
    if (allReturned) {
      order.orderStatus = "Return Requested";
    }
  } else {
    order.orderStatus = "Return Requested";

    for (const item of order.products) {
      if (item.orderStatus === "Delivered") {
        item.orderStatus = "Return Requested";
        item.returnReason = reason;
      }
    }
  }

  await order.save();
  return { success: true };
};

export const getWalletPageData = async (userId) => {
  const [user, transactions] = await Promise.all([
    User.findById(userId).select("walletBalance").lean(),
    WalletTransaction.find({ userId }).sort({ createdAt: -1 }).lean()
  ]);

  return {
    walletBalance: user?.walletBalance || 0,
    transactions
  };
};
