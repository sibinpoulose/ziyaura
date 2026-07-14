import express from "express";

import {
  adminLogin,
  loadCustomers,
  blockUser,
  unblockUser,
  adminLogout,
  loadAdminLoginPage,
  loadAdminDashboard
} from "../../controllers/admin/adminController.js";
import categoryRoutes from "./categoryRoutes.js"
import productRoutes from "./productRoutes.js";
import orderRoutes from "./orderRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";
import { adminProtect } from "../../middlewares/authMiddleware.js";
import { isAdminGuest } from "../../middlewares/guestMiddleware.js";

const router = express.Router();

// ADMIN LOGIN PAGE

router.get(
  "/login",
  isAdminGuest,

  loadAdminLoginPage
);

// ADMIN LOGIN

router.post(
  "/login",

  adminLogin
);

// ADMIN DASHBOARD

router.get(
  "/dashboard",
  adminProtect,

  loadAdminDashboard
);

// CUSTOMERS PAGE

router.get(
  "/customers",
  adminProtect,

  loadCustomers
);
router.get(
  "/block-user/:id",

  blockUser
);

router.get(
  "/unblock-user/:id",

  unblockUser
);
router.get(
  "/logout",

  adminLogout
);
router.use(
  "/",
  categoryRoutes
);
router.use(
  "/",
  productRoutes
);
router.use(
  "/",
  orderRoutes
);
router.use(
  "/",
  inventoryRoutes
);

export default router;
