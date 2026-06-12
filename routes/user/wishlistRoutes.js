import express from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import {
  loadWishlistPage,
  addToWishlist,
  removeFromWishlist
} from "../../controllers/user/wishlistController.js";

const router = express.Router();

router.get("/wishlist", protect, loadWishlistPage);
router.post("/wishlist/add", protect, addToWishlist);
router.post("/wishlist/remove/:id", protect, removeFromWishlist);

export default router;
