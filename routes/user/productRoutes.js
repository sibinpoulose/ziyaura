import express from "express";

const router = express.Router();

import {
  loadProductsPage,
  loadProductDetailsPage
} from "../../controllers/user/productController.js";
import { protect } from "../../middlewares/authMiddleware.js";
router.get(
  "/products",
  loadProductsPage
);

router.get(
  "/product/:slug",protect,
  loadProductDetailsPage
);

export default router;