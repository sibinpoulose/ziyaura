import {
  getAdminOrdersData,
  getAdminOrderById,
  updateAdminOrderStatusService,
  getReturnOrdersList,
  processReturnRequestService
} from "../../services/admin/orderService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const loadOrdersPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";
    const statusFilter = req.query.status || "";
    const sort = req.query.sort || "dateDesc";

    const data = await getAdminOrdersData({
      page,
      limit: 10,
      search,
      statusFilter,
      sort
    });

    res.render("admin/orders", data);
  } catch (error) {
    console.error("Admin Load Orders Page Error:", error);
    req.session.error = "Unable to load orders list.";
    res.redirect("/admin/dashboard");
  }
};

export const loadOrderDetailPage = async (req, res) => {
  try {
    const order = await getAdminOrderById(req.params.id);
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

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    const result = await updateAdminOrderStatusService(id, orderStatus);

    if (result.error) {
      const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({ success: false, message: result.error });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Order status successfully updated to ${orderStatus}.`
    });
  } catch (error) {
    console.error("Admin Update Order Status Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to update order status." });
  }
};

export const loadReturnorder = async (req, res) => {
  try {
    const orders = await getReturnOrdersList();
    res.render("admin/returnedorder", { orders });
  } catch (error) {
    console.error("Load Returns Page Error:", error);
    res.redirect("/admin/dashboard");
  }
};

export const processReturnRequest = async (req, res) => {
  try {
    const { orderId, itemId, action } = req.body;

    const result = await processReturnRequestService({ orderId, itemId, action });
    if (result.error) {
      const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({ success: false, message: result.error });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Return request ${action}ed successfully. Refunded: ₹${result.refundAmount.toFixed(2)}`
    });
  } catch (error) {
    console.error("Process Return Error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to process return request." });
  }
};
