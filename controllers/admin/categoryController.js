import {
  getCategoriesWithPagination,
  getCategoryById,
  checkDuplicateCategoryName,
  parseVariantTypes,
  validateVariantTypes,
  createCategoryService,
  updateCategoryService,
  toggleCategoryStatusService,
  toggleCategoryFeaturedService
} from "../../services/admin/categoryService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const loadCategoryPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";
    const sort = req.query.sort || "newest";

    const data = await getCategoriesWithPagination({
      search,
      sort,
      page,
      limit: 5
    });

    res.render("admin/category/category-list", data);
  } catch (error) {
    console.error("Load Category Error:", error);
    req.session.error = "Unable to load categories";
    res.redirect("/admin/dashboard");
  }
};

export const loadAddCategoryPage = (req, res) => {
  try {
    res.render("admin/category/add-category");
  } catch (error) {
    console.error("Load Add Category Page Error:", error);
    req.session.error = "Something went wrong";
    res.redirect("/admin/dashboard");
  }
};

export const addCategory = async (req, res) => {
  try {
    const { name, description, seoTitle, seoDescription, variantNames, variantValues } = req.body;

    if (!name?.trim()) {
      req.session.error = "Category name is required";
      return res.redirect("/admin/categories/add");
    }

    if (!req.file) {
      req.session.error = "Category image is required";
      return res.redirect("/admin/categories/add");
    }

    const existingCategory = await checkDuplicateCategoryName(name);
    if (existingCategory) {
      req.session.error = "Category already exists";
      return res.redirect("/admin/categories/add");
    }

    const variantTypes = parseVariantTypes(variantNames, variantValues);
    const variantError = validateVariantTypes(variantTypes);
    if (variantError) {
      req.session.error = variantError;
      return res.redirect("/admin/categories/add");
    }

    const image = req.file ? req.file.path : "";

    await createCategoryService({
      name,
      description,
      seoTitle,
      seoDescription,
      image,
      variantTypes
    });

    req.session.success = "Category added successfully";
    return res.redirect("/admin/categories");
  } catch (error) {
    console.error("Add Category Error:", error);
    req.session.error = "Something went wrong";
    return res.redirect("/admin/categories/add");
  }
};

export const loadEditCategoryPage = async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id);

    if (!category) {
      req.session.error = "Category not found";
      return res.redirect("/admin/categories");
    }

    res.render("admin/category/edit-category", { category });
  } catch (error) {
    console.error("Load Edit Category Page Error:", error);
    res.redirect("/admin/categories");
  }
};

export const editCategory = async (req, res) => {
  try {
    const { name, description, seoTitle, seoDescription, variantNames, variantValues } = req.body;

    const category = await getCategoryById(req.params.id);
    if (!category) {
      req.session.error = "Category not found";
      return res.redirect("/admin/categories");
    }

    if (!name?.trim()) {
      req.session.error = "Category name is required";
      return res.redirect(`/admin/categories/edit/${req.params.id}`);
    }

    const existingCategory = await checkDuplicateCategoryName(name, req.params.id);
    if (existingCategory) {
      req.session.error = "Category already exists";
      return res.redirect(`/admin/categories/edit/${req.params.id}`);
    }

    const variantTypes = parseVariantTypes(variantNames, variantValues);
    const variantError = validateVariantTypes(variantTypes);
    if (variantError) {
      req.session.error = variantError;
      return res.redirect(`/admin/categories/edit/${req.params.id}`);
    }

    const image = req.file ? req.file.path : null;

    await updateCategoryService(req.params.id, {
      name,
      description,
      seoTitle,
      seoDescription,
      image,
      variantTypes
    });

    req.session.success = "Category updated successfully";
    return res.redirect("/admin/categories");
  } catch (error) {
    console.error("Edit Category Error:", error);
    req.session.error = "Something went wrong";
    return res.redirect("/admin/categories");
  }
};

export const toggleCategoryStatus = async (req, res) => {
  try {
    const updated = await toggleCategoryStatusService(req.params.id);
    if (!updated) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Category not found"
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Category status updated"
    });
  } catch (error) {
    console.error("Toggle Category Status Error:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

export const getCategoryVariants = async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id);
    if (!category) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Category not found"
      });
    }
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      variantTypes: category.variantTypes || []
    });
  } catch (error) {
    console.error("Get Category Variants Error:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

export const toggleCategoryFeatured = async (req, res) => {
  try {
    const result = await toggleCategoryFeaturedService(req.params.id);
    if (result.error) {
      const status = result.error === "Category not found" ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({
        success: false,
        message: result.error
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Category featured status updated"
    });
  } catch (error) {
    console.error("Toggle Featured Error:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Something went wrong"
    });
  }
};
