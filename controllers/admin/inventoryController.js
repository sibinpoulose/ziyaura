import { getInventoryData, updateProductStockService } from "../../services/admin/inventoryService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const loadInventoryPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";
    const categoryFilter = req.query.category || "";
    const stockStatus = req.query.stockStatus || "all";
    const sort = req.query.sort || "newest";

    const data = await getInventoryData({
      page,
      limit: 10,
      search,
      categoryFilter,
      stockStatus,
      sort
    });

    res.render("admin/inventory", data);
  } catch (error) {
    console.error("Admin Load Inventory Page Error:", error);
    req.session.error = "Unable to load inventory page.";
    res.redirect("/admin/dashboard");
  }
};

export const updateStock = async (req, res) => {
  try {
    const { productId, variantId, newStock } = req.body;

    if (newStock === undefined || newStock === null || isNaN(newStock) || parseInt(newStock) < 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Invalid stock number." });
    }

    const result = await updateProductStockService({ productId, variantId, newStock });
    if (result.error) {
      const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({ success: false, message: result.error });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Stock updated successfully.",
      newStock: result.newStock
    });
  } catch (error) {
    console.error("Admin Update Stock Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to update stock level." });
  }
};
