import express from "express";
import {
  loadOrdersPage,
  loadOrderDetailPage,
  updateOrderStatus
} from "../../controllers/admin/orderController.js";
import { adminProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/orders", adminProtect, loadOrdersPage);
router.get("/orders/:id", adminProtect, loadOrderDetailPage);
router.post("/orders/:id/status", adminProtect, updateOrderStatus);

export default router;
