import express from "express";

const router = express.Router();

import upload from "../../middlewares/categoryUpload.js";

import { adminProtect } from "../../middlewares/authMiddleware.js";

import {
  loadCategoryPage,
  loadAddCategoryPage,
  addCategory,
  loadEditCategoryPage,
  editCategory,
  toggleCategoryStatus,
  getCategoryVariants,
  toggleCategoryFeatured
} from "../../controllers/admin/categoryController.js";

// CATEGORY LIST

router.get(
  "/categories",

  adminProtect,

  loadCategoryPage
);

// GET CATEGORY VARIANTS FOR PRODUCTS (JSON API)
router.get(
  "/categories/:id/variants",

  adminProtect,

  getCategoryVariants
);

// ADD CATEGORY PAGE

router.get(
  "/categories/add",

  adminProtect,

  loadAddCategoryPage
);

// ADD CATEGORY
router.post(
  "/categories/add",

  adminProtect,

  upload.single("image"),

  addCategory
);

// EDIT CATEGORY PAGE

router.get(
  "/categories/edit/:id",

  adminProtect,

  loadEditCategoryPage
);

// EDIT CATEGORY

router.post(
  "/categories/edit/:id",

  adminProtect,

  upload.single("image"),

  editCategory
);

// LIST / UNLIST

router.patch(
  "/categories/toggle/:id",

  adminProtect,

  toggleCategoryStatus
);

// TOGGLE FEATURED
router.patch(
  "/categories/toggle-featured/:id",

  adminProtect,

  toggleCategoryFeatured
);

export default router;
