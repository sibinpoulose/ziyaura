import Category from "../../models/category.js";

// CATEGORY LIST
export const loadCategoryPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;

    const limit = 5;

    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    const sort = req.query.sort || "newest";

    const query = {
      name: {
        $regex: search,

        $options: "i"
      }
    };

    let sortOption = {
      createdAt: -1
    };

    // SORTING

    if (sort === "oldest") {
      sortOption = {
        createdAt: 1
      };
    }

    if (sort === "az") {
      sortOption = {
        name: 1
      };
    }

    if (sort === "za") {
      sortOption = {
        name: -1
      };
    }

    const categories = await Category.find(query)

      .sort(sortOption)

      .skip(skip)

      .limit(limit);

    const totalCategories = await Category.countDocuments(query);

    const totalPages = Math.ceil(totalCategories / limit);

    res.render("admin/category/category-list", {
      categories,

      search,

      sort,

      currentPage: page,

      totalPages
    });
  } catch (error) {
    console.log("Load Category Error:", error);

    req.session.error = "Unable to load categories";

    res.redirect("/admin/dashboard");
  }
};

// ADD PAGE

export const loadAddCategoryPage = (req, res) => {
  try {
    res.render("admin/category/add-category");
  } catch (error) {
    console.log("Load Add Category Page Error:", error);

    req.session.error = "Something went wrong";

    res.redirect("/admin/dashboard");
  }
};

// ADD CATEGORY

export const addCategory = async (req, res) => {
  try {
    console.log("========== ADD CATEGORY ==========");
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    const { name, description, seoTitle, seoDescription } = req.body;

    const variantNames = req.body.variantNames || [];
    const variantValues = req.body.variantValues || [];

    // CATEGORY NAME REQUIRED

    if (!name?.trim()) {
      req.session.error = "Category name is required";

      return res.redirect("/admin/categories/add");
    }
    if (!req.file) {

  req.session.error =
    "Category image is required";

  return res.redirect(
    "/admin/categories/add"
  );

}
    // CHECK DUPLICATE CATEGORY

    const existingCategory = await Category.findOne({
      name: {
        $regex: `^${name.trim()}$`,
        $options: "i"
      }
    });

    if (existingCategory) {
      req.session.error = "Category already exists";

      return res.redirect("/admin/categories/add");
    }

    // GENERATE SLUG

    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");

    // CLOUDINARY IMAGE URL

    const image = req.file ? req.file.path : "";
    //variant handling//
    const variantTypes = [];

    const namesList = Array.isArray(variantNames)
      ? variantNames
      : [variantNames];

    const valuesList = Array.isArray(variantValues)
      ? variantValues
      : [variantValues];

    namesList.forEach((variantName, index) => {
      const trimmedName = variantName?.trim();
      if (trimmedName) {
        const rawValues = valuesList[index] || "";
        const values = rawValues
          .split(",")
          .map(val => val.trim())
          .filter(val => val !== "");
        variantTypes.push({
          name: trimmedName,
          values: values
        });
      }
    });

    if (variantTypes.length === 0) {
      req.session.error = "At least one variant type is required";
      return res.redirect("/admin/categories/add");
    }

    const hasEmptyValues = variantTypes.some(vt => vt.values.length === 0);
    if (hasEmptyValues) {
      req.session.error = "All variant types must have at least one value";
      return res.redirect("/admin/categories/add");
    }

    const variantTypeNames = new Set();
    for (const vt of variantTypes) {
      const lowerName = vt.name.toLowerCase();
      if (variantTypeNames.has(lowerName)) {
        req.session.error = `Duplicate variant type name "${vt.name}" is not allowed`;
        return res.redirect("/admin/categories/add");
      }
      variantTypeNames.add(lowerName);
    }
    // CREATE CATEGORY
    console.log("VARIANT TYPES:", variantTypes);
    await Category.create({
      name: name.trim(),

      slug,

      description,

      image,

      seoTitle,

      seoDescription,

      variantTypes
    });

    req.session.success = "Category added successfully";

    return res.redirect("/admin/categories");
  } catch (error) {
    console.log("================================");
    console.log(error.message);
    console.log(error);
    console.log("================================");

    console.log("Add Category Error:", error);

    req.session.error = "Something went wrong";

    return res.redirect("/admin/categories/add");
  }
};

// EDIT PAGE

export const loadEditCategoryPage = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      req.session.error = "Category not found";

      return res.redirect("/admin/categories");
    }

    res.render("admin/category/edit-category", { category });
  } catch (error) {
    console.log(error);

    res.redirect("/admin/categories");
  }
};

// EDIT CATEGORY

export const editCategory = async (req, res) => {
  try {
    const {
      name,

      description,

      seoTitle,

      seoDescription
    } = req.body;
    const variantNames = req.body.variantNames || [];
    const variantValues = req.body.variantValues || [];

    // CATEGORY EXISTS

    const category = await Category.findById(req.params.id);

    if (!category) {
      req.session.error = "Category not found";

      return res.redirect("/admin/categories");
    }

    // NAME REQUIRED

    if (!name?.trim()) {
      req.session.error = "Category name is required";

      return res.redirect(`/admin/categories/edit/${req.params.id}`);
    }

    // DUPLICATE CHECK

    const existingCategory = await Category.findOne({
      _id: {
        $ne: req.params.id
      },

      name: {
        $regex: `^${name.trim()}$`,

        $options: "i"
      }
    });

    if (existingCategory) {
      req.session.error = "Category already exists";

      return res.redirect(`/admin/categories/edit/${req.params.id}`);
    }

    // UPDATE NAME

    category.name = name.trim();

    // AUTO UPDATE SLUG

    category.slug = name.trim().toLowerCase().replace(/\s+/g, "-");

    // UPDATE OTHER FIELDS

    category.description = description || "";

    category.seoTitle = seoTitle || "";

    category.seoDescription = seoDescription || "";

    // UPDATE IMAGE

    if (req.file) {
      category.image = req.file.path;
    }
    const variantTypes = [];

    const namesList = Array.isArray(variantNames)
      ? variantNames
      : [variantNames];

    const valuesList = Array.isArray(variantValues)
      ? variantValues
      : [variantValues];

    namesList.forEach((variantName, index) => {
      const trimmedName = variantName?.trim();
      if (trimmedName) {
        const rawValues = valuesList[index] || "";
        const values = rawValues
          .split(",")
          .map(val => val.trim())
          .filter(val => val !== "");
        variantTypes.push({
          name: trimmedName,
          values: values
        });
      }
    });

    if (variantTypes.length === 0) {
      req.session.error = "At least one variant type is required";
      return res.redirect(`/admin/categories/edit/${req.params.id}`);
    }

    const hasEmptyValues = variantTypes.some(vt => vt.values.length === 0);
    if (hasEmptyValues) {
      req.session.error = "All variant types must have at least one value";
      return res.redirect(`/admin/categories/edit/${req.params.id}`);
    }

    const variantTypeNames = new Set();
    for (const vt of variantTypes) {
      const lowerName = vt.name.toLowerCase();
      if (variantTypeNames.has(lowerName)) {
        req.session.error = `Duplicate variant type name "${vt.name}" is not allowed`;
        return res.redirect(`/admin/categories/edit/${req.params.id}`);
      }
      variantTypeNames.add(lowerName);
    }
    category.variantTypes = variantTypes;

    await category.save();

    req.session.success = "Category updated successfully";

    return res.redirect("/admin/categories");
  } catch (error) {
    console.log("Edit Category Error:", error);

    req.session.error = "Something went wrong";

    return res.redirect("/admin/categories");
  }
};
export const deletecategory=async (req,res)=>{
  try{
    const category=await Category.findById(req.params.id)
    
  }
  catch{}

}

// LIST / UNLIST
export const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,

        message: "Category not found"
      });
    }

    category.isListed = !category.isListed;

    await category.save();

    return res.json({
      success: true,

      message: "Category status updated"
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,

      message: "Something went wrong"
    });
  }
};

// GET CATEGORY VARIANTS (JSON)
export const getCategoryVariants = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }
    return res.json({
      success: true,
      variantTypes: category.variantTypes || []
    });
  } catch (error) {
    console.log("Get Category Variants Error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

// TOGGLE FEATURED ON LANDING STATUS
export const toggleCategoryFeatured = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    if (!category.isFeatured) {
      // Must be listed to be featured
      if (!category.isListed) {
        return res.status(400).json({
          success: false,
          message: "Unlisted categories cannot be featured on the landing page."
        });
      }

      // Max 4 check
      const featuredCount = await Category.countDocuments({ isFeatured: true });
      if (featuredCount >= 4) {
        return res.status(400).json({
          success: false,
          message: "Maximum of 4 featured categories allowed. Please un-feature another category first."
        });
      }
    }

    category.isFeatured = !category.isFeatured;
    await category.save();

    return res.json({
      success: true,
      message: "Category featured status updated"
    });
  } catch (error) {
    console.log("Toggle Featured Error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};
