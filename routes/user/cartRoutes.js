import express from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import {
  loadCartPage,
  addToCart,
  updateCartQuantity,
  removeFromCart
} from "../../controllers/user/cartController.js";

const router = express.Router();

router.get("/cart", protect, loadCartPage);
router.post("/cart/add", protect, addToCart);
router.post("/cart/update-quantity", protect, updateCartQuantity);
router.post("/cart/remove/:id", protect, removeFromCart);

export default router;
