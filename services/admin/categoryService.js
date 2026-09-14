import Category from "../../models/category.js";

export const getCategoriesWithPagination = async ({ search = "", sort = "newest", page = 1, limit = 5 }) => {
  const skip = (page - 1) * limit;

  const query = {
    name: {
      $regex: search,
      $options: "i"
    }
  };

  let sortOption = { createdAt: -1 };
  if (sort === "oldest") sortOption = { createdAt: 1 };
  if (sort === "az") sortOption = { name: 1 };
  if (sort === "za") sortOption = { name: -1 };

  const [categories, totalCategories] = await Promise.all([
    Category.find(query).sort(sortOption).skip(skip).limit(limit).lean(),
    Category.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalCategories / limit);

  return {
    categories,
    totalPages,
    currentPage: page,
    search,
    sort
  };
};

export const getCategoryById = async (id) => {
  return await Category.findById(id);
};

export const checkDuplicateCategoryName = async (name, excludeId = null) => {
  const query = {
    name: {
      $regex: `^${name.trim()}$`,
      $options: "i"
    }
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return await Category.findOne(query);
};

export const parseVariantTypes = (variantNames, variantValues) => {
  const variantTypes = [];
  const namesList = Array.isArray(variantNames) ? variantNames : [variantNames];
  const valuesList = Array.isArray(variantValues) ? variantValues : [variantValues];

  namesList.forEach((variantName, index) => {
    const trimmedName = variantName?.trim();
    if (trimmedName) {
      const rawValues = valuesList[index] || "";
      const values = rawValues
        .split(",")
        .map((val) => val.trim())
        .filter((val) => val !== "");
      variantTypes.push({
        name: trimmedName,
        values: values
      });
    }
  });

  return variantTypes;
};

export const validateVariantTypes = (variantTypes) => {
  if (!variantTypes || variantTypes.length === 0) {
    return "At least one variant type is required";
  }

  const hasEmptyValues = variantTypes.some((vt) => vt.values.length === 0);
  if (hasEmptyValues) {
    return "All variant types must have at least one value";
  }

  const variantTypeNames = new Set();
  for (const vt of variantTypes) {
    const lowerName = vt.name.toLowerCase();
    if (variantTypeNames.has(lowerName)) {
      return `Duplicate variant type name "${vt.name}" is not allowed`;
    }
    variantTypeNames.add(lowerName);
  }

  return null;
};

export const createCategoryService = async ({ name, description, seoTitle, seoDescription, image, variantTypes }) => {
  const slug = name.trim().toLowerCase().replace(/\s+/g, "-");

  return await Category.create({
    name: name.trim(),
    slug,
    description: description || "",
    image: image || "",
    seoTitle: seoTitle || "",
    seoDescription: seoDescription || "",
    variantTypes
  });
};

export const updateCategoryService = async (id, { name, description, seoTitle, seoDescription, image, variantTypes }) => {
  const category = await Category.findById(id);
  if (!category) return null;

  category.name = name.trim();
  category.slug = name.trim().toLowerCase().replace(/\s+/g, "-");
  category.description = description || "";
  category.seoTitle = seoTitle || "";
  category.seoDescription = seoDescription || "";
  category.variantTypes = variantTypes;

  if (image) {
    category.image = image;
  }

  return await category.save();
};

export const toggleCategoryStatusService = async (id) => {
  const category = await Category.findById(id);
  if (!category) return null;

  category.isListed = !category.isListed;
  return await category.save();
};

export const toggleCategoryFeaturedService = async (id) => {
  const category = await Category.findById(id);
  if (!category) return { error: "Category not found" };

  if (!category.isFeatured) {
    if (!category.isListed) {
      return { error: "Unlisted categories cannot be featured on the landing page." };
    }

    const featuredCount = await Category.countDocuments({ isFeatured: true });
    if (featuredCount >= 4) {
      return { error: "Maximum of 4 featured categories allowed. Please un-feature another category first." };
    }
  }

  category.isFeatured = !category.isFeatured;
  await category.save();

  return { success: true, category };
};
