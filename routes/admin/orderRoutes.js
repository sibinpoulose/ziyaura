import express from "express";
import {
  loadOrdersPage,
  loadOrderDetailPage,
  updateOrderStatus,
  loadReturnorder,
  processReturnRequest
} from "../../controllers/admin/orderController.js";
import { adminProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/orders", adminProtect, loadOrdersPage);
router.get("/orders/:id", adminProtect, loadOrderDetailPage);
router.post("/orders/:id/status", adminProtect, updateOrderStatus);
router.get("/return", adminProtect, loadReturnorder);
router.post("/returns/process", adminProtect, processReturnRequest);

export default router;
