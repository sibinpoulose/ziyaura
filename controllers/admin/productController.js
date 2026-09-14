import {
  getAdminProductsWithPagination,
  getAdminAddProductPageData,
  getAdminEditProductPageData,
  validateProductInput,
  processProductVariants,
  createAdminProductService,
  updateAdminProductService,
  toggleProductStatusService,
  deleteProductService
} from "../../services/admin/productService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const loadProductsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";
    const categoryFilter = req.query.category || "";
    const sort = req.query.sort || "newest";

    const data = await getAdminProductsWithPagination({
      page,
      limit: 5,
      search,
      categoryFilter,
      sort
    });

    res.render("admin/product/product-list", data);
  } catch (error) {
    console.error("Load Products Page Error:", error);
    req.session.error = "Unable to load products";
    res.redirect("/admin/dashboard");
  }
};

export const loadAddProductPage = async (req, res) => {
  try {
    const categories = await getAdminAddProductPageData();
    res.render("admin/product/add-product", { categories });
  } catch (error) {
    console.error("Load Add Product Page Error:", error);
    req.session.error = "Something went wrong";
    res.redirect("/admin/products");
  }
};

export const addProduct = async (req, res) => {
  try {
    const { name, brand, description, category } = req.body;

    const validationResult = await validateProductInput({
      name,
      brand,
      category,
      files: req.files
    });

    if (typeof validationResult === "string") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: validationResult });
    }

    const { categoryDoc } = validationResult;
    const images = req.files.map((file) => file.path);

    const variantResult = processProductVariants({
      rawVariants: req.body.variants,
      categoryDoc,
      combinedImages: images,
      body: req.body
    });

    if (variantResult.error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: variantResult.error });
    }

    await createAdminProductService({
      name: name.trim(),
      brand: brand.trim(),
      description: description || "",
      category,
      images,
      variants: variantResult.variants,
      price: variantResult.price,
      salePrice: variantResult.salePrice,
      stock: variantResult.stock,
      sku: variantResult.sku
    });

    req.session.success = "Product added successfully";
    return res.status(HTTP_STATUS.OK).json({ success: true, message: "Product created successfully" });
  } catch (error) {
    console.error("Add Product Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Something went wrong" });
  }
};

export const loadEditProductPage = async (req, res) => {
  try {
    const data = await getAdminEditProductPageData(req.params.id);
    if (!data) {
      req.session.error = "Product not found";
      return res.redirect("/admin/products");
    }

    res.render("admin/product/edit-product", { product: data.product, categories: data.categories });
  } catch (error) {
    console.error("Load Edit Product Page Error:", error);
    res.redirect("/admin/products");
  }
};

export const editProduct = async (req, res) => {
  try {
    const { name, brand, description, category } = req.body;
    const existingImages = req.body.existingImages
      ? Array.isArray(req.body.existingImages)
        ? req.body.existingImages
        : [req.body.existingImages]
      : [];

    const validationResult = await validateProductInput({
      name,
      brand,
      category,
      files: req.files,
      existingImages,
      excludeId: req.params.id
    });

    if (typeof validationResult === "string") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: validationResult });
    }

    const { categoryDoc } = validationResult;
    const newUploadedImages = req.files ? req.files.map((file) => file.path) : [];
    const combinedImages = [...existingImages, ...newUploadedImages];

    const variantResult = processProductVariants({
      rawVariants: req.body.variants,
      categoryDoc,
      combinedImages,
      body: req.body
    });

    if (variantResult.error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: variantResult.error });
    }

    const updated = await updateAdminProductService(req.params.id, {
      name,
      brand,
      description,
      category,
      images: combinedImages,
      variants: variantResult.variants,
      price: variantResult.price,
      salePrice: variantResult.salePrice,
      stock: variantResult.stock,
      sku: variantResult.sku
    });

    if (!updated) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "Product not found" });
    }

    req.session.success = "Product updated successfully";
    return res.status(HTTP_STATUS.OK).json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    console.error("Edit Product Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Something went wrong" });
  }
};

export const toggleProductStatus = async (req, res) => {
  try {
    const updated = await toggleProductStatusService(req.params.id);
    if (!updated) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "Product not found" });
    }

    return res.status(HTTP_STATUS.OK).json({ success: true, message: "Product status updated successfully" });
  } catch (error) {
    console.error("Toggle Product Status Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Something went wrong" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const deleted = await deleteProductService(req.params.id);
    if (!deleted) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "Product not found" });
    }

    return res.status(HTTP_STATUS.OK).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete Product Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Something went wrong" });
  }
};
