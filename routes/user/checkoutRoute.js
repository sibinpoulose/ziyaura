import express from "express";

import { protect } from "../../middlewares/authMiddleware.js";

import {
  loadCheckoutPage,
  placeOrder,
  loadOrderSuccessPage
} from "../../controllers/user/checkoutController.js";

const router = express.Router();

router.get(
  "/checkout",
  protect,
  loadCheckoutPage
);

router.post(
  "/checkout/place-order",
  protect,
  placeOrder
);

router.get(
  "/order-success/:orderId",
  protect,
  loadOrderSuccessPage
);

export default router;