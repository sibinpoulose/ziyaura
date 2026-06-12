import express from "express";

import {
  adminLogin,
  loadCustomers,
  blockUser,
  unblockUser,
  adminLogout,
  loadblockeduser
} from "../../controllers/admin/adminController.js";
import categoryRoutes from "./categoryRoutes.js"
import productRoutes from "./productRoutes.js";
import { adminProtect } from "../../middlewares/authMiddleware.js";
import { isGuest } from "../../middlewares/guestMiddleware.js";

const router = express.Router();

// ADMIN LOGIN PAGE

router.get(
  "/login",
  isGuest,

  (req, res) => {
    res.render("admin/login");
  }
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

  (req, res) => {
    res.render("admin/dashboard");
  }
);
router.get("/blockeduser", adminProtect, loadblockeduser);

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

export default router;
