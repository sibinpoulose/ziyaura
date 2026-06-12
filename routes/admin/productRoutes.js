import express from "express";
const router = express.Router();

import upload from "../../middlewares/productUpload.js";
import { adminProtect } from "../../middlewares/authMiddleware.js";
import {
  loadProductsPage,
  loadAddProductPage,
  addProduct,
  loadEditProductPage,
  editProduct,
  toggleProductStatus,
  deleteProduct
} from "../../controllers/admin/productController.js";

// PRODUCT LIST
router.get("/products", adminProtect, loadProductsPage);

// ADD PRODUCT
router.get("/products/add", adminProtect, loadAddProductPage);
router.post("/products/add", adminProtect, upload.array("images", 10), addProduct);

// EDIT PRODUCT
router.get("/products/edit/:id", adminProtect, loadEditProductPage);
router.post("/products/edit/:id", adminProtect, upload.array("images", 10), editProduct);

// TOGGLE LIST STATUS
router.patch("/products/toggle/:id", adminProtect, toggleProductStatus);

// SOFT DELETE
router.delete("/products/delete/:id", adminProtect, deleteProduct);

export default router;
