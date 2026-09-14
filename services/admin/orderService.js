import Order from "../../models/order.js";
import User from "../../models/User.js";
import Product from "../../models/product.js";
import WalletTransaction from "../../models/walletTransaction.js";
import { recalculateOrderFinancials } from "../../utils/orderUtils.js";

export const getAdminOrdersData = async ({ page = 1, limit = 10, search = "", statusFilter = "", sort = "dateDesc" }) => {
  const skip = (page - 1) * limit;

  let query = {};

  if (statusFilter) {
    query.orderStatus = statusFilter;
  }

  if (search) {
    const users = await User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ]
    }).select("_id");
    const userIds = users.map((u) => u._id);

    query.$or = [
      { orderId: { $regex: search, $options: "i" } },
      { userId: { $in: userIds } }
    ];
  }

  let sortOption = { createdAt: -1 };
  if (sort === "dateAsc") sortOption = { createdAt: 1 };
  if (sort === "totalDesc") sortOption = { grandTotal: -1 };
  if (sort === "totalAsc") sortOption = { grandTotal: 1 };

  const [orders, totalOrders] = await Promise.all([
    Order.find(query)
      .populate("userId", "name email phone")
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalOrders / limit);

  return {
    orders,
    search,
    statusFilter,
    sort,
    currentPage: page,
    totalPages
  };
};

export const getAdminOrderById = async (id) => {
  return await Order.findById(id).populate("userId", "name email phone");
};

export const updateAdminOrderStatusService = async (id, orderStatus) => {
  const validStatuses = ["Pending", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
  if (!validStatuses.includes(orderStatus)) {
    return { error: "Invalid order status." };
  }

  const order = await Order.findById(id);
  if (!order) {
    return { error: "Order not found.", notFound: true };
  }

  if (order.orderStatus === "Cancelled") {
    return { error: "Cannot update a cancelled order." };
  }

  const oldStatus = order.orderStatus;
  order.orderStatus = orderStatus;

  order.products.forEach((item) => {
    if (item.orderStatus !== "Cancelled" && item.orderStatus !== "Returned") {
      item.orderStatus = orderStatus;
    }
  });

  if (orderStatus === "Cancelled" && oldStatus !== "Cancelled") {
    for (const item of order.products) {
      if (item.orderStatus === "Cancelled" && item.cancelReason === "") {
        item.cancelReason = "Cancelled by admin";
      }

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

    await recalculateOrderFinancials(order);
  }

  if (orderStatus === "Delivered") {
    order.paymentStatus = "Paid";
  }

  await order.save();
  return { success: true, orderStatus };
};

export const getReturnOrdersList = async () => {
  return await Order.find({
    $or: [{ orderStatus: "Return Requested" }, { "products.orderStatus": "Return Requested" }]
  })
    .populate("userId", "name email")
    .lean();
};

export const processReturnRequestService = async ({ orderId, itemId, action }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    return { error: "Order not found.", notFound: true };
  }

  let refundAmount = 0;

  if (itemId) {
    const item = order.products.id(itemId);
    if (!item || item.orderStatus !== "Return Requested") {
      return { error: "Item is not in Return Requested status." };
    }

    if (action === "accept") {
      item.orderStatus = "Returned";

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
      item.orderStatus = "Return Rejected";
    }

    const allReturned = order.products.every((p) =>
      ["Returned", "Cancelled", "Return Rejected"].includes(p.orderStatus)
    );
    if (allReturned) {
      order.orderStatus = "Returned";
    }
  } else {
    if (action === "accept") {
      order.orderStatus = "Returned";

      for (const item of order.products) {
        if (item.orderStatus === "Return Requested") {
          item.orderStatus = "Returned";

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
    } else {
      order.orderStatus = "Return Rejected";
      order.products.forEach((p) => {
        if (p.orderStatus === "Return Requested") p.orderStatus = "Return Rejected";
      });
    }
  }

  if (action === "accept") {
    refundAmount = await recalculateOrderFinancials(order);
  }

  if (action === "accept" && refundAmount > 0) {
    const user = await User.findById(order.userId);
    if (user) {
      user.walletBalance = (user.walletBalance || 0) + refundAmount;
      await user.save();
    }

    await WalletTransaction.create({
      userId: order.userId,
      amount: refundAmount,
      type: "credit",
      description: `Refund for Approved Return: ${order.orderId}`,
      orderId: order.orderId
    });

    order.paymentStatus = "Refunded";
  }

  await order.save();
  return { success: true, refundAmount };
};
