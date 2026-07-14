import Product from "../../models/product.js";
import Category from "../../models/category.js";

// 1. LOAD INVENTORY/STOCK MANAGEMENT PAGE
export const loadInventoryPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const categoryFilter = req.query.category || "";
    const stockStatus = req.query.stockStatus || "all"; // all, outOfStock, lowStock, inStock
    const sort = req.query.sort || "newest";

    // Base query: only non-deleted products
    let query = { isDeleted: false };

    // A. Category Filter
    if (categoryFilter) {
      query.category = categoryFilter;
    }

    // B. Search (Name, Brand, SKU, Variant SKU)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { "variants.sku": { $regex: search, $options: "i" } }
      ];
    }

    // C. Stock Status Filter
    if (stockStatus === "outOfStock") {
      query.$or = [
        { variants: { $size: 0 }, stock: 0 },
        { 
          variants: { $exists: true, $not: { $elemMatch: { stock: { $gt: 0 } } } },
          "variants.0": { $exists: true }
        }
      ];
    } else if (stockStatus === "lowStock") {
      // Defined as stock > 0 and stock < 5
      query.$or = [
        { variants: { $size: 0 }, stock: { $gt: 0, $lt: 5 } },
        { variants: { $elemMatch: { stock: { $gt: 0, $lt: 5 } } } }
      ];
    } else if (stockStatus === "inStock") {
      // Defined as stock >= 5
      query.$or = [
        { variants: { $size: 0 }, stock: { $gte: 5 } },
        { variants: { $elemMatch: { stock: { $gte: 5 } } } }
      ];
    }

    // D. Sorting Options
    let sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    if (sort === "nameAsc") sortOption = { name: 1 };
    if (sort === "nameDesc") sortOption = { name: -1 };
    if (sort === "stockAsc") sortOption = { stock: 1 };
    if (sort === "stockDesc") sortOption = { stock: -1 };

    // Query Products
    const products = await Product.find(query)
      .populate("category", "name")
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch listed categories for filter dropdown
    const categories = await Category.find({ isListed: true });

    res.render("admin/inventory", {
      products,
      categories,
      search,
      categoryFilter,
      stockStatus,
      sort,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.error("Admin Load Inventory Page Error:", error);
    req.session.error = "Unable to load inventory page.";
    res.redirect("/admin/dashboard");
  }
};

// 2. AJAX ENDPOINT TO UPDATE STOCK LEVEL INLINE
export const updateStock = async (req, res) => {
  try {
    const { productId, variantId, newStock } = req.body;

    if (newStock === undefined || newStock === null || isNaN(newStock) || parseInt(newStock) < 0) {
      return res.status(400).json({ success: false, message: "Invalid stock number." });
    }

    const stockVal = parseInt(newStock);
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    if (variantId) {
      // Find variant and update stock
      const variant = product.variants.id(variantId);
      if (!variant) {
        return res.status(404).json({ success: false, message: "Product variant not found." });
      }
      variant.stock = stockVal;
    } else {
      // Update product level stock
      product.stock = stockVal;
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Stock updated successfully.",
      newStock: stockVal
    });
  } catch (error) {
    console.error("Admin Update Stock Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update stock level." });
  }
};
