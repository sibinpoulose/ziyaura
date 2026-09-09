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

// Coupon Admin Imports
import { loadCouponsPage, createCoupon, updateCoupon, deleteCoupon } from "../../controllers/admin/adminCouponController.js";
// Offer Admin Imports
import { loadOffersPage, createOffer, deleteOffer } from "../../controllers/admin/adminOfferController.js";
// Reports Imports
import { loadSalesReport, downloadExcelReport, downloadPDFReport } from "../../controllers/admin/reportsController.js";

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

// Coupons Admin Routes
router.get("/coupons", adminProtect, loadCouponsPage);
router.post("/coupons/create", adminProtect, createCoupon);
router.post("/coupons/update", adminProtect, updateCoupon);
router.delete("/coupons/delete/:id", adminProtect, deleteCoupon);

// Offers Admin Routes
router.get("/offers", adminProtect, loadOffersPage);
router.post("/offers/create", adminProtect, createOffer);
router.delete("/offers/delete/:id", adminProtect, deleteOffer);

// Sales Reports Routes
router.get("/sales-report", adminProtect, loadSalesReport);
router.get("/sales-report/excel", adminProtect, downloadExcelReport);
router.get("/sales-report/pdf", adminProtect, downloadPDFReport);

export default router;
