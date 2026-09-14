import {
  getCheckoutPageData,
  placeUserOrderService,
  verifyRazorpayPaymentService,
  markPaymentAsFailed,
  getOrderSuccessData,
  initiateRepaymentService
} from "../../services/user/checkoutService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const loadCheckoutPage = async (req, res) => {
  try {
    const data = await getCheckoutPageData(req.user._id, req.session.couponCode);

    if (data.error) {
      req.session.error = data.error;
      return res.redirect(data.redirectUrl || "/cart");
    }

    if (data.couponCode && !req.session.couponCode) {
      delete req.session.couponCode;
    }

    res.render("user/checkout", data);
  } catch (error) {
    console.error("Load Checkout Page Error:", error);
    req.session.error = "Unable to load checkout";
    res.redirect("/cart");
  }
};

export const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;

    const result = await placeUserOrderService({
      userId: req.user._id,
      userObj: req.user,
      addressId,
      paymentMethod,
      couponCode
    });

    if (result.error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: result.error });
    }

    if (couponCode) {
      delete req.session.couponCode;
    }

    return res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    console.error("Place Order Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to place order. Please try again." });
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const result = await verifyRazorpayPaymentService({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    });

    if (result.error) {
      const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({ success: false, message: result.error });
    }

    return res
      .status(HTTP_STATUS.OK)
      .json({ success: true, message: "Payment verified successfully." });
  } catch (error) {
    console.error("Payment Verification Error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Server error during verification." });
  }
};

export const handlePaymentFailure = async (req, res) => {
  try {
    const { orderId } = req.body;
    await markPaymentAsFailed(orderId);
    res.status(HTTP_STATUS.OK).json({ success: true });
  } catch (error) {
    console.error("Handle Payment Failure Error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

export const loadOrderSuccessPage = async (req, res) => {
  try {
    const order = await getOrderSuccessData(req.params.orderId, req.user._id);
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
    const order = await getOrderSuccessData(req.params.orderId, req.user._id);
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
    const result = await initiateRepaymentService(req.params.orderId, req.user._id, req.user);

    if (result.error) {
      const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({ success: false, message: result.error });
    }

    return res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    console.error("Initiate Repayment Error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to initiate repayment gateway." });
  }
};