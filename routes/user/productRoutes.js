import express from "express";

const router = express.Router();

import {
  loadProductsPage,
  loadProductDetailsPage
} from "../../controllers/user/productController.js";

router.get(
  "/products",
  loadProductsPage
);

router.get(
  "/product/:slug",
  loadProductDetailsPage
);

export default router;