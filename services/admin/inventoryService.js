import Product from "../../models/product.js";
import Category from "../../models/category.js";

export const getInventoryData = async ({
  page = 1,
  limit = 10,
  search = "",
  categoryFilter = "",
  stockStatus = "all",
  sort = "newest"
}) => {
  const skip = (page - 1) * limit;

  const query = { isDeleted: false };

  if (categoryFilter) {
    query.category = categoryFilter;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { "variants.sku": { $regex: search, $options: "i" } }
    ];
  }

  if (stockStatus === "outOfStock") {
    query.$or = [
      { variants: { $size: 0 }, stock: 0 },
      {
        variants: { $exists: true, $not: { $elemMatch: { stock: { $gt: 0 } } } },
        "variants.0": { $exists: true }
      }
    ];
  } else if (stockStatus === "lowStock") {
    query.$or = [
      { variants: { $size: 0 }, stock: { $gt: 0, $lt: 5 } },
      { variants: { $elemMatch: { stock: { $gt: 0, $lt: 5 } } } }
    ];
  } else if (stockStatus === "inStock") {
    query.$or = [
      { variants: { $size: 0 }, stock: { $gte: 5 } },
      { variants: { $elemMatch: { stock: { $gte: 5 } } } }
    ];
  }

  let sortOption = { createdAt: -1 };
  if (sort === "oldest") sortOption = { createdAt: 1 };
  if (sort === "nameAsc") sortOption = { name: 1 };
  if (sort === "nameDesc") sortOption = { name: -1 };
  if (sort === "stockAsc") sortOption = { stock: 1 };
  if (sort === "stockDesc") sortOption = { stock: -1 };

  const [products, totalProducts, categories] = await Promise.all([
    Product.find(query).populate("category", "name").sort(sortOption).skip(skip).limit(limit).lean(),
    Product.countDocuments(query),
    Category.find({ isListed: true }).select("name").lean()
  ]);

  const totalPages = Math.ceil(totalProducts / limit);

  return {
    products,
    categories,
    search,
    categoryFilter,
    stockStatus,
    sort,
    currentPage: page,
    totalPages
  };
};

export const updateProductStockService = async ({ productId, variantId, newStock }) => {
  const stockVal = parseInt(newStock);
  const product = await Product.findById(productId);
  if (!product) return { error: "Product not found.", notFound: true };

  if (variantId) {
    const variant = product.variants.id(variantId);
    if (!variant) return { error: "Product variant not found.", notFound: true };
    variant.stock = stockVal;
  } else {
    product.stock = stockVal;
  }

  await product.save();
  return { success: true, newStock: stockVal };
};
