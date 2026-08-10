import Order from "../../models/order.js";
import Product from "../../models/product.js";
import User from "../../models/User.js";
import WalletTransaction from "../../models/walletTransaction.js";
import { generateInvoicePDF } from "../../utils/invoiceGenerator.js";

//  ORDER LISTING WITH SEARCH & PAGINATION
export const loadOrdersPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // 5 orders per page
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    // Build filter query
    const filterQuery = { userId: req.user._id };

    if (search) {
      filterQuery.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { "products.name": { $regex: search, $options: "i" } }
      ];
    }

    const totalOrders = await Order.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(filterQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render("user/order-list", {
      orders,
      currentPage: page,
      totalPages,
      search
    });
  } catch (error) {
    console.error("Load Orders Page Error:", error);
    req.session.error = "Unable to load orders.";
    res.redirect("/profile");
  }
};

//  ORDER DETAIL PAGE
export const loadOrderDetailPage = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) {
      req.session.error = "Order not found.";
      return res.redirect("/profile/orders");
    }

    res.render("user/order-detail", { order });
  } catch (error) {
    console.error("Load Order Detail Error:", error);
    req.session.error = "Unable to load order details.";
    res.redirect("/profile/orders");
  }
};

//  CANCEL ORDER OR SPECIFIC PRODUCTS WITH INSTANT WALLET REFUND (Prepaid/Wallet payments)
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params; // Order MongoDB ID
    const { itemId, reason } = req.body; // If cancelling a specific product, itemId is passed

    const order = await Order.findOne({ _id: id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.orderStatus === "Delivered" || order.orderStatus === "Cancelled") {
      return res.status(400).json({ success: false, message: "Cannot cancel this order." });
    }

    let refundAmount = 0;

    if (itemId) {
      // Cancel a single item
      const item = order.products.id(itemId);
      if (!item) {
        return res.status(404).json({ success: false, message: "Item not found in order." });
      }

      if (["Cancelled", "Returned", "Return Requested"].includes(item.orderStatus)) {
        return res.status(400).json({ success: false, message: "Item is already cancelled or returned." });
      }

      item.orderStatus = "Cancelled";
      item.cancelReason = reason || "Cancelled by user";

      // Increment stock back
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

      // Calculate refund proportional share
      if (order.paymentStatus === "Paid" && (order.paymentMethod === "ONLINE" || order.paymentMethod === "WALLET")) {
        const priceRatio = item.total / order.subtotal;
        const discountReduction = order.discount * priceRatio;
        refundAmount = item.total - discountReduction;
      }

      // Check if all items in order are now cancelled
      const allCancelled = order.products.every(p => p.orderStatus === "Cancelled");
      if (allCancelled) {
        order.orderStatus = "Cancelled";
      }
    } else {
      // Cancel the entire order
      order.orderStatus = "Cancelled";

      // Restore stock for all products that were not already cancelled
      for (const item of order.products) {
        if (item.orderStatus !== "Cancelled") {
          item.orderStatus = "Cancelled";
          item.cancelReason = reason || "Cancelled by user";

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

      // Refund entire paid total
      if (order.paymentStatus === "Paid" && (order.paymentMethod === "ONLINE" || order.paymentMethod === "WALLET")) {
        refundAmount = order.grandTotal;
      }
    }

    // Process Refund to wallet instantly for cancellation
    if (refundAmount > 0) {
      const user = await User.findById(req.user._id);
      user.walletBalance = (user.walletBalance || 0) + refundAmount;
      await user.save();

      await WalletTransaction.create({
        userId: req.user._id,
        amount: refundAmount,
        type: "credit",
        description: `Refund for Cancelled Order: ${order.orderId}`,
        orderId: order.orderId
      });

      order.paymentStatus = "Refunded";
    }

    await order.save();
    return res.status(200).json({ success: true, message: "Cancellation processed successfully.", refundAmount });
  } catch (error) {
    console.error("Cancel Order Error:", error);
    return res.status(500).json({ success: false, message: "Failed to process cancellation." });
  }
};

//  RETURN ORDER REQUEST - MARKS STATUS AS "Return Requested" (Admin must confirm to issue wallet credit)
export const returnOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId, reason } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ success: false, message: "Return reason is mandatory." });
    }

    const order = await Order.findOne({ _id: id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.orderStatus !== "Delivered") {
      return res.status(400).json({ success: false, message: "Only delivered orders can be returned." });
    }

    if (itemId) {
      // Return single item
      const item = order.products.id(itemId);
      if (!item) {
        return res.status(404).json({ success: false, message: "Item not found in order." });
      }

      if (item.orderStatus !== "Delivered") {
        return res.status(400).json({ success: false, message: "Only delivered items can be returned." });
      }

      item.orderStatus = "Return Requested";
      item.returnReason = reason;

      // Check if all items in order are returned (or cancelled/returned)
      const allReturned = order.products.every(p => ["Return Requested", "Returned", "Cancelled"].includes(p.orderStatus));
      if (allReturned) {
        order.orderStatus = "Return Requested"; // Mark main order as Return Requested
      }
    } else {
      // Return entire order
      order.orderStatus = "Return Requested";

      for (const item of order.products) {
        if (item.orderStatus === "Delivered") {
          item.orderStatus = "Return Requested";
          item.returnReason = reason;
        }
      }
    }

    await order.save();
    return res.status(200).json({ success: true, message: "Return request submitted successfully. Awaiting admin confirmation." });
  } catch (error) {
    console.error("Return Order Error:", error);
    return res.status(500).json({ success: false, message: "Failed to process return request." });
  }
};

// 5. DOWNLOAD INVOICE (PDF)
export const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) {
      req.session.error = "Order not found.";
      return res.redirect("/profile/orders");
    }

    // Set response headers to force download PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Invoice-${order.orderId}.pdf`);

    // Stream PDF directly to client response
    generateInvoicePDF(order, res);
  } catch (error) {
    console.error("Download Invoice Error:", error);
    req.session.error = "Failed to download invoice.";
    res.redirect(`/profile/orders/${req.params.id}`);
  }
};

// 6. WALLET PAGE & STATEMENTS LISTING
export const loadWalletPage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const transactions = await WalletTransaction.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.render("user/wallet", {
      walletBalance: user.walletBalance || 0,
      transactions
    });
  } catch (error) {
    console.error("Load Wallet Error:", error);
    req.session.error = "Unable to load wallet page.";
    res.redirect("/profile");
  }
};