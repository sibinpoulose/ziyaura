import express from "express";
import authRoutes from "./user/authRoutes.js";
import productRoutes from "./user/productRoutes.js";
import cartRoutes from "./user/cartRoutes.js";
import wishlistRoutes from "./user/wishlistRoutes.js";
import checkoutRoutes from "./user/checkoutRoute.js";
import profileRoutes from "./user/profileRoutes.js";
import adminRoutes from "./admin/adminauth.js";
import orderRoutes from "./user/orderRoutes.js"

const router = express.Router(); /*mini express app*/

router.use("/", authRoutes);
router.use("/", productRoutes);
router.use("/", cartRoutes);
router.use("/", wishlistRoutes);
router.use("/", checkoutRoutes);
router.use("/", orderRoutes);
router.use("/profile", profileRoutes);
router.use("/admin", adminRoutes);

export default router; /*exporting a single router line which export all other routes   */
