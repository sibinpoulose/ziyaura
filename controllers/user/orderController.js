import {
  getUserOrdersList,
  getUserOrderDetail,
  cancelUserOrderService,
  requestOrderReturnService,
  getWalletPageData
} from "../../services/user/orderService.js";
import { generateInvoicePDF } from "../../utils/invoiceGenerator.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const loadOrdersPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";

    const data = await getUserOrdersList({
      userId: req.user._id,
      page,
      limit: 5,
      search
    });

    res.render("user/order-list", data);
  } catch (error) {
    console.error("Load Orders Page Error:", error);
    req.session.error = "Unable to load orders.";
    res.redirect("/profile");
  }
};

export const loadOrderDetailPage = async (req, res) => {
  try {
    const order = await getUserOrderDetail(req.params.id, req.user._id);
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

export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId, reason } = req.body;

    const result = await cancelUserOrderService({
      orderId: id,
      userId: req.user._id,
      itemId,
      reason
    });

    if (result.error) {
      const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({ success: false, message: result.error });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Cancellation processed successfully.",
      refundAmount: result.refundAmount
    });
  } catch (error) {
    console.error("Cancel Order Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to process cancellation." });
  }
};

export const returnOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId, reason } = req.body;

    const result = await requestOrderReturnService({
      orderId: id,
      userId: req.user._id,
      itemId,
      reason
    });

    if (result.error) {
      const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({ success: false, message: result.error });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Return request submitted successfully. Awaiting admin confirmation."
    });
  } catch (error) {
    console.error("Return Order Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to process return request." });
  }
};

export const downloadInvoice = async (req, res) => {
  try {
    const order = await getUserOrderDetail(req.params.id, req.user._id);
    if (!order) {
      req.session.error = "Order not found.";
      return res.redirect("/profile/orders");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Invoice-${order.orderId}.pdf`);

    generateInvoicePDF(order, res);
  } catch (error) {
    console.error("Download Invoice Error:", error);
    req.session.error = "Failed to download invoice.";
    res.redirect(`/profile/orders/${req.params.id}`);
  }
};

export const loadWalletPage = async (req, res) => {
  try {
    const data = await getWalletPageData(req.user._id);
    res.render("user/wallet", data);
  } catch (error) {
    console.error("Load Wallet Error:", error);
    req.session.error = "Unable to load wallet page.";
    res.redirect("/profile");
  }
};