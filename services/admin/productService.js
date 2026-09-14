import Product from "../../models/product.js";
import Category from "../../models/category.js";

export const getAdminProductsWithPagination = async ({
  page = 1,
  limit = 5,
  search = "",
  categoryFilter = "",
  sort = "newest"
}) => {
  const skip = (page - 1) * limit;

  const query = { isDeleted: false };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } }
    ];
  }

  if (categoryFilter) {
    query.category = categoryFilter;
  }

  let sortOption = { createdAt: -1 };
  if (sort === "oldest") sortOption = { createdAt: 1 };
  if (sort === "az") sortOption = { name: 1 };
  if (sort === "za") sortOption = { name: -1 };
  if (sort === "priceAsc") sortOption = { price: 1 };
  if (sort === "priceDesc") sortOption = { price: -1 };

  const [products, totalProducts, categories] = await Promise.all([
    Product.find(query).populate("category").sort(sortOption).skip(skip).limit(limit).lean(),
    Product.countDocuments(query),
    Category.find({ isListed: true }).select("name").lean()
  ]);

  const totalPages = Math.ceil(totalProducts / limit);

  return {
    products,
    categories,
    search,
    categoryFilter,
    sort,
    currentPage: page,
    totalPages
  };
};

export const getAdminAddProductPageData = async () => {
  return await Category.find({ isListed: true }).lean();
};

export const getAdminEditProductPageData = async (productId) => {
  const [product, categories] = await Promise.all([
    Product.findById(productId).populate("category"),
    Category.find({ isListed: true }).lean()
  ]);

  if (!product || product.isDeleted) return null;
  return { product, categories };
};

export const validateProductInput = async ({
  name,
  brand,
  category,
  files,
  existingImages = [],
  excludeId = null
}) => {
  if (!name?.trim()) return "Product name is required";
  if (!brand?.trim()) return "Brand is required";
  if (!category) return "Category is required";

  const duplicateQuery = {
    name: { $regex: `^${name.trim()}$`, $options: "i" },
    isDeleted: false
  };
  if (excludeId) duplicateQuery._id = { $ne: excludeId };

  const existingProduct = await Product.findOne(duplicateQuery);
  if (existingProduct) return "Product name already exists";

  const totalImages = (files ? files.length : 0) + existingImages.length;
  if (totalImages < 3) return "At least 3 product images are required";

  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) return "Invalid category selected";

  return { categoryDoc };
};

export const processProductVariants = ({ rawVariants, categoryDoc, combinedImages, body }) => {
  const hasVariantsConfigured = categoryDoc.variantTypes && categoryDoc.variantTypes.length > 0;
  let variants = [];
  let price = undefined;
  let salePrice = null;
  let stock = undefined;
  let sku = undefined;

  if (hasVariantsConfigured) {
    if (!rawVariants) {
      return { error: "Category requires product variants configuration" };
    }

    try {
      variants = typeof rawVariants === "string" ? JSON.parse(rawVariants) : rawVariants;
    } catch {
      return { error: "Invalid variants format payload" };
    }

    if (!variants || variants.length === 0) {
      return { error: "At least one variant option combo is required" };
    }

    for (const variant of variants) {
      if (!variant.sku?.trim()) {
        return { error: "SKU is required for all variants" };
      }
      if (
        variant.price === undefined ||
        variant.price === null ||
        isNaN(Number(variant.price)) ||
        Number(variant.price) < 0
      ) {
        return { error: "Valid Price is required for all variants" };
      }
      if (
        variant.stock === undefined ||
        variant.stock === null ||
        isNaN(Number(variant.stock)) ||
        Number(variant.stock) < 0
      ) {
        return { error: "Valid Stock is required for all variants" };
      }
      if (variant.salePrice !== undefined && variant.salePrice !== null && variant.salePrice !== "") {
        if (isNaN(Number(variant.salePrice)) || Number(variant.salePrice) < 0) {
          return { error: "Sale price must be a valid positive number" };
        }
        if (Number(variant.salePrice) >= Number(variant.price)) {
          return { error: "Sale price must be lower than original price" };
        }
      }
      if (!variant.combination || variant.combination.length !== categoryDoc.variantTypes.length) {
        return { error: "Variants must include all category variant dimensions" };
      }

      const imgIndex = Number(variant.imageIndex) || 0;
      if (!variant.image) {
        variant.image = combinedImages[imgIndex] || combinedImages[0] || "";
      }
    }
  } else {
    price = Number(body.price);
    salePrice = body.salePrice ? Number(body.salePrice) : null;
    stock = Number(body.stock);
    sku = body.sku?.trim();

    if (isNaN(price) || price < 0) return { error: "Valid base price is required" };
    if (isNaN(stock) || stock < 0) return { error: "Valid base stock is required" };
    if (!sku) return { error: "Base SKU is required" };

    if (salePrice !== null && salePrice !== undefined) {
      if (salePrice < 0) return { error: "Sale price must be a positive number" };
      if (salePrice >= price) return { error: "Sale price must be less than base price" };
    }

    variants = [];
  }

  return { variants, price, salePrice, stock, sku };
};

export const createAdminProductService = async (productData) => {
  const slug = productData.name.trim().toLowerCase().replace(/\s+/g, "-");
  return await Product.create({
    ...productData,
    slug
  });
};

export const updateAdminProductService = async (productId, updateFields) => {
  const product = await Product.findById(productId);
  if (!product || product.isDeleted) return null;

  product.name = updateFields.name.trim();
  product.slug = updateFields.name.trim().toLowerCase().replace(/\s+/g, "-");
  product.brand = updateFields.brand.trim();
  product.description = updateFields.description || "";
  product.category = updateFields.category;
  product.images = updateFields.images;
  product.variants = updateFields.variants;
  product.price = updateFields.price;
  product.salePrice = updateFields.salePrice;
  product.stock = updateFields.stock;
  product.sku = updateFields.sku;

  return await product.save();
};

export const toggleProductStatusService = async (productId) => {
  const product = await Product.findById(productId);
  if (!product || product.isDeleted) return null;

  product.isListed = !product.isListed;
  return await product.save();
};

export const deleteProductService = async (productId) => {
  const product = await Product.findById(productId);
  if (!product || product.isDeleted) return null;

  product.isDeleted = true;
  return await product.save();
};
