import Product from "../../models/product.js";
import Category from "../../models/category.js";

// 1. LOAD PRODUCTS PAGE (WITH SEARCH, PAGINATION, CATEGORY FILTER, SORT)
export const loadProductsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const categoryFilter = req.query.category || "";
    const sort = req.query.sort || "newest";

    // Build search query (only non-deleted products)
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

    // Sort options
    let sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    if (sort === "az") sortOption = { name: 1 };
    if (sort === "za") sortOption = { name: -1 };
    if (sort === "priceAsc") sortOption = { price: 1 };
    if (sort === "priceDesc") sortOption = { price: -1 };

    const products = await Product.find(query)
      .populate("category")
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch listed categories for filter dropdown
    const categories = await Category.find({ isListed: true });

    res.render("admin/product/product-list", {
      products,
      categories,
      search,
      categoryFilter,
      sort,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.log("Load Products Page Error:", error);
    req.session.error = "Unable to load products";
    res.redirect("/admin/dashboard");
  }
};

// 2. LOAD ADD PRODUCT PAGE
export const loadAddProductPage = async (req, res) => {
  try {
    // Only allow adding products to active (listed) categories
    const categories = await Category.find({ isListed: true });
    res.render("admin/product/add-product", { categories });
  } catch (error) {
    console.log("Load Add Product Page Error:", error);
    req.session.error = "Something went wrong";
    res.redirect("/admin/products");
  }
};

// 3. ADD PRODUCT
export const addProduct = async (req, res) => {
  try {
    const { name, brand, description, category } = req.body;

    // Basic Text validation
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }
    if (!brand?.trim()) {
      return res.status(400).json({ success: false, message: "Brand is required" });
    }
    if (!category) {
      return res.status(400).json({ success: false, message: "Category is required" });
    }

    // Check duplicate
    const existingProduct = await Product.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      isDeleted: false
    });
    if (existingProduct) {
      return res.status(400).json({ success: false, message: "Product name already exists" });
    }

    // Image upload validation (min 3)
    if (!req.files || req.files.length < 3) {
      return res.status(400).json({ success: false, message: "At least 3 product images are required" });
    }

    const images = req.files.map(file => file.path);

    // Find category to check variants configuration
    const cat = await Category.findById(category);
    if (!cat) {
      return res.status(400).json({ success: false, message: "Invalid category selected" });
    }

    const hasVariantsConfigured = cat.variantTypes && cat.variantTypes.length > 0;
    let variants = [];
    let price, salePrice, stock, sku;

    if (hasVariantsConfigured) {
      // Parse variants from request body
      if (!req.body.variants) {
        return res.status(400).json({ success: false, message: "Category requires product variants configuration" });
      }

      try {
        variants = typeof req.body.variants === "string" ? JSON.parse(req.body.variants) : req.body.variants;
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid variants format payload" });
      }

      if (!variants || variants.length === 0) {
        return res.status(400).json({ success: false, message: "At least one variant option combo is required" });
      }

      // Validate each variant
      for (const variant of variants) {
        if (!variant.sku?.trim()) {
          return res.status(400).json({ success: false, message: "SKU is required for all variants" });
        }
        if (variant.price === undefined || variant.price === null || isNaN(Number(variant.price)) || Number(variant.price) < 0) {
          return res.status(400).json({ success: false, message: "Valid Price is required for all variants" });
        }
        if (variant.stock === undefined || variant.stock === null || isNaN(Number(variant.stock)) || Number(variant.stock) < 0) {
          return res.status(400).json({ success: false, message: "Valid Stock is required for all variants" });
        }
        if (variant.salePrice !== undefined && variant.salePrice !== null && variant.salePrice !== "") {
          if (isNaN(Number(variant.salePrice)) || Number(variant.salePrice) < 0) {
            return res.status(400).json({ success: false, message: "Sale price must be a valid positive number" });
          }
          if (Number(variant.salePrice) >= Number(variant.price)) {
            return res.status(400).json({ success: false, message: "Sale price must be lower than original price" });
          }
        }
        // combination structure check
        if (!variant.combination || variant.combination.length !== cat.variantTypes.length) {
          return res.status(400).json({ success: false, message: "Variants must include all category variant dimensions" });
        }

        // Map variant image index to uploaded Cloudinary URL (or fallback to primary)
        const imgIndex = Number(variant.imageIndex) || 0;
        variant.image = images[imgIndex] || images[0] || "";
      }
    } else {
      // Direct base details
      price = Number(req.body.price);
      salePrice = req.body.salePrice ? Number(req.body.salePrice) : null;
      stock = Number(req.body.stock);
      sku = req.body.sku?.trim();

      if (isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, message: "Valid base price is required" });
      }
      if (isNaN(stock) || stock < 0) {
        return res.status(400).json({ success: false, message: "Valid base stock is required" });
      }
      if (!sku) {
        return res.status(400).json({ success: false, message: "Base SKU is required" });
      }
      if (salePrice !== null && salePrice !== undefined) {
        if (salePrice < 0) {
          return res.status(400).json({ success: false, message: "Sale price must be a positive number" });
        }
        if (salePrice >= price) {
          return res.status(400).json({ success: false, message: "Sale price must be less than base price" });
        }
      }
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");

    await Product.create({
      name: name.trim(),
      slug,
      brand: brand.trim(),
      description: description || "",
      category,
      images,
      variants,
      price,
      salePrice,
      stock,
      sku
    });

    req.session.success = "Product added successfully";
    return res.json({ success: true, message: "Product created successfully" });
  } catch (error) {
    console.log("Add Product Error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// 4. LOAD EDIT PRODUCT PAGE
export const loadEditProductPage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category");
    if (!product || product.isDeleted) {
      req.session.error = "Product not found";
      return res.redirect("/admin/products");
    }

    const categories = await Category.find({ isListed: true });
    res.render("admin/product/edit-product", { product, categories });
  } catch (error) {
    console.log("Load Edit Product Page Error:", error);
    res.redirect("/admin/products");
  }
};

// 5. EDIT PRODUCT
export const editProduct = async (req, res) => {
  try {
    const { name, brand, description, category } = req.body;
    const existingImages = req.body.existingImages ? (Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages]) : [];

    const product = await Product.findById(req.params.id);
    if (!product || product.isDeleted) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }
    if (!brand?.trim()) {
      return res.status(400).json({ success: false, message: "Brand is required" });
    }
    if (!category) {
      return res.status(400).json({ success: false, message: "Category is required" });
    }

    // Check duplicate name
    const duplicateProduct = await Product.findOne({
      _id: { $ne: req.params.id },
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      isDeleted: false
    });
    if (duplicateProduct) {
      return res.status(400).json({ success: false, message: "Product name already exists" });
    }

    // Combine images (existing + newly uploaded)
    const newUploadedImages = req.files ? req.files.map(file => file.path) : [];
    const combinedImages = [...existingImages, ...newUploadedImages];

    if (combinedImages.length < 3) {
      return res.status(400).json({ success: false, message: "Product must have at least 3 images" });
    }

    // Check category variants config
    const cat = await Category.findById(category);
    if (!cat) {
      return res.status(400).json({ success: false, message: "Invalid category selected" });
    }

    const hasVariantsConfigured = cat.variantTypes && cat.variantTypes.length > 0;
    let variants = [];
    let price = undefined, salePrice = null, stock = undefined, sku = undefined;

    if (hasVariantsConfigured) {
      if (!req.body.variants) {
        return res.status(400).json({ success: false, message: "Category requires product variants configuration" });
      }

      try {
        variants = typeof req.body.variants === "string" ? JSON.parse(req.body.variants) : req.body.variants;
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid variants format payload" });
      }

      if (!variants || variants.length === 0) {
        return res.status(400).json({ success: false, message: "At least one variant option combo is required" });
      }

      for (const variant of variants) {
        if (!variant.sku?.trim()) {
          return res.status(400).json({ success: false, message: "SKU is required for all variants" });
        }
        if (variant.price === undefined || variant.price === null || isNaN(Number(variant.price)) || Number(variant.price) < 0) {
          return res.status(400).json({ success: false, message: "Valid Price is required for all variants" });
        }
        if (variant.stock === undefined || variant.stock === null || isNaN(Number(variant.stock)) || Number(variant.stock) < 0) {
          return res.status(400).json({ success: false, message: "Valid Stock is required for all variants" });
        }
        if (variant.salePrice !== undefined && variant.salePrice !== null && variant.salePrice !== "") {
          if (isNaN(Number(variant.salePrice)) || Number(variant.salePrice) < 0) {
            return res.status(400).json({ success: false, message: "Sale price must be a valid positive number" });
          }
          if (Number(variant.salePrice) >= Number(variant.price)) {
            return res.status(400).json({ success: false, message: "Sale price must be lower than original price" });
          }
        }
        if (!variant.combination || variant.combination.length !== cat.variantTypes.length) {
          return res.status(400).json({ success: false, message: "Variants must include all category variant dimensions" });
        }

        // Map variant image index to uploaded Cloudinary URL (or fallback to primary)
        const imgIndex = Number(variant.imageIndex) || 0;
        if (!variant.image) {
          variant.image = combinedImages[imgIndex] || combinedImages[0] || "";
        }
      }
      
      // Clear fallback values since variants are active
      price = undefined;
      salePrice = null;
      stock = undefined;
      sku = undefined;
    } else {
      // Direct base details
      price = Number(req.body.price);
      salePrice = req.body.salePrice ? Number(req.body.salePrice) : null;
      stock = Number(req.body.stock);
      sku = req.body.sku?.trim();

      if (isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, message: "Valid base price is required" });
      }
      if (isNaN(stock) || stock < 0) {
        return res.status(400).json({ success: false, message: "Valid base stock is required" });
      }
      if (!sku) {
        return res.status(400).json({ success: false, message: "Base SKU is required" });
      }
      if (salePrice !== null && salePrice !== undefined) {
        if (salePrice < 0) {
          return res.status(400).json({ success: false, message: "Sale price must be a positive number" });
        }
        if (salePrice >= price) {
          return res.status(400).json({ success: false, message: "Sale price must be less than base price" });
        }
      }

      // Clear variants array since base mode is active
      variants = [];
    }

    product.name = name.trim();
    product.slug = name.trim().toLowerCase().replace(/\s+/g, "-");
    product.brand = brand.trim();
    product.description = description || "";
    product.category = category;
    product.images = combinedImages;
    product.variants = variants;
    product.price = price;
    product.salePrice = salePrice;
    product.stock = stock;
    product.sku = sku;

    await product.save();

    req.session.success = "Product updated successfully";
    return res.json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    console.log("Edit Product Error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// 6. TOGGLE LIST/UNLIST STATUS
export const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.isDeleted) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    product.isListed = !product.isListed;
    await product.save();

    return res.json({ success: true, message: `Product status updated successfully` });
  } catch (error) {
    console.log("Toggle Product Status Error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// 7. SOFT DELETE
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.isDeleted) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    product.isDeleted = true;
    await product.save();

    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.log("Delete Product Error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
