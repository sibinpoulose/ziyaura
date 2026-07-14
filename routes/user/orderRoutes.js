import express from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import {
  loadOrdersPage,
  loadOrderDetailPage,
  cancelOrder,
  returnOrder,
  downloadInvoice
} from "../../controllers/user/orderController.js";

const router = express.Router();

// Fetch orders listing page
router.get("/profile/orders", protect, loadOrdersPage);

// Fetch specific order details
router.get("/profile/orders/:id", protect, loadOrderDetailPage);

// Cancel the whole order or a specific item
router.post("/profile/orders/:id/cancel", protect, cancelOrder);

// Return the whole order or a specific item
router.post("/profile/orders/:id/return", protect, returnOrder);

// Download PDF Invoice
router.get("/profile/orders/:id/invoice", protect, downloadInvoice);

export default router;