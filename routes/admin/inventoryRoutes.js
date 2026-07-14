import express from "express";
import {
  loadInventoryPage,
  updateStock
} from "../../controllers/admin/inventoryController.js";
import { adminProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/inventory", adminProtect, loadInventoryPage);
router.post("/inventory/update", adminProtect, updateStock);

export default router;
