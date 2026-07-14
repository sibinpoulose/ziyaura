import Order from "../../models/order.js";
import User from "../../models/User.js";
import Product from "../../models/product.js";

// 1. LOAD ORDERS LIST PAGE (WITH SEARCH, SORT, FILTER, PAGINATION)
export const loadOrdersPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // 10 orders per page
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const statusFilter = req.query.status || "";
    const sort = req.query.sort || "dateDesc";

    // Build the query
    let query = {};

    // 1. Status Filter
    if (statusFilter) {
      query.orderStatus = statusFilter;
    }

    // 2. Search (OrderId or Customer Name/Email)
    if (search) {
      // Find matching users first
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      }).select("_id");
      const userIds = users.map(u => u._id);

      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { userId: { $in: userIds } }
      ];
    }

    // 3. Sorting
    let sortOption = { createdAt: -1 }; // Default: Newest first
    if (sort === "dateAsc") sortOption = { createdAt: 1 };
    if (sort === "totalDesc") sortOption = { grandTotal: -1 };
    if (sort === "totalAsc") sortOption = { grandTotal: 1 };

    // Fetch orders
    const orders = await Order.find(query)
      .populate("userId", "name email phone")
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("admin/orders", {
      orders,
      search,
      statusFilter,
      sort,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.error("Admin Load Orders Page Error:", error);
    req.session.error = "Unable to load orders list.";
    res.redirect("/admin/dashboard");
  }
};

// 2. LOAD ORDER DETAILS PAGE
export const loadOrderDetailPage = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("userId", "name email phone");
    if (!order) {
      req.session.error = "Order not found.";
      return res.redirect("/admin/orders");
    }

    res.render("admin/order-details", { order });
  } catch (error) {
    console.error("Admin Load Order Detail Error:", error);
    req.session.error = "Unable to load order details.";
    res.redirect("/admin/orders");
  }
};

// 3. UPDATE ORDER STATUS (AJAX ENDPOINT)
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    const validStatuses = ["Pending", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ success: false, message: "Invalid order status." });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // If order is already Cancelled or Delivered, restrict modifying
    if (order.orderStatus === "Cancelled") {
      return res.status(400).json({ success: false, message: "Cannot update a cancelled order." });
    }

    const oldStatus = order.orderStatus;
    order.orderStatus = orderStatus;

    // Synchronize individual products status if not cancelled/returned
    order.products.forEach(item => {
      if (item.orderStatus !== "Cancelled" && item.orderStatus !== "Returned") {
        item.orderStatus = orderStatus;
      }
    });

    // Handle stock restoration if changing to Cancelled
    if (orderStatus === "Cancelled" && oldStatus !== "Cancelled") {
      for (const item of order.products) {
        // Stock restoration for non-cancelled items
        if (item.orderStatus === "Cancelled" && item.cancelReason === "") {
          item.cancelReason = "Cancelled by admin";
        }
        
        const product = await Product.findById(item.productId);
        if (product) {
          if (item.variantId) {
            const variant = product.variants.id(item.variantId);
            if (variant) {
              variant.stock += item.quantity;
            }
          } else {
            product.stock += item.quantity;
          }
          await product.save();
        }
      }
    }

    // Auto mark paid if delivered
    if (orderStatus === "Delivered") {
      order.paymentStatus = "Paid";
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status successfully updated to ${orderStatus}.`
    });
  } catch (error) {
    console.error("Admin Update Order Status Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update order status." });
  }
};
