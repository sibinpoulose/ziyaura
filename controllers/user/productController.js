import Product from "../../models/product.js";
import Category from "../../models/category.js";

// LOAD PRODUCTS LIST PAGE (WITH ADVANCED FILTERS, SORT, SEARCH, PAGINATION)
export const loadProductsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9; // 9 products per page (3x3 grid)
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const categorySlug = req.query.category || "";
    const sort = req.query.sort || "newest";
    const selectedBrand = req.query.brand || "";
    const inStock = req.query.inStock === "true";
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || Infinity;

    // Fetch listed categories
    const activeCategories = await Category.find({ isListed: true });
    const activeCategoryIds = activeCategories.map(c => c._id);

    // Build initial match query
    const matchQuery = {
      isDeleted: false,
      isListed: true,
      category: { $in: activeCategoryIds }
    };

    // Category filter
    if (categorySlug) {
      const selectedCategory = activeCategories.find(c => c.slug === categorySlug);
      if (selectedCategory) {
        matchQuery.category = selectedCategory._id;
      } else {
        matchQuery.category = null; // Forces empty result if invalid/blocked category is requested
      }
    }

    // Brand filter
    if (selectedBrand) {
      matchQuery.brand = selectedBrand;
    }

    // Search query
    if (search) {
      matchQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } }
      ];
    }

    // Aggregation pipeline to compute fields on the fly
    const pipeline = [
      { $match: matchQuery },
      {
        $addFields: {
          effectivePrice: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
              then: {
                $min: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$variants",
                        as: "v",
                        cond: { $eq: ["$$v.isListed", true] }
                      }
                    },
                    as: "v",
                    in: { $cond: [{ $ne: ["$$v.salePrice", null] }, "$$v.salePrice", "$$v.price"] }
                  }
                }
              },
              else: {
                $cond: [{ $ne: ["$salePrice", null] }, "$salePrice", "$price"]
              }
            }
          },
          totalStock: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
              then: {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$variants",
                        as: "v",
                        cond: { $eq: ["$$v.isListed", true] }
                      }
                    },
                    as: "v",
                    in: "$$v.stock"
                  }
                }
              },
              else: "$stock"
            }
          }
        }
      }
    ];

    // Filter by computed effectivePrice
    const priceFilter = {
      effectivePrice: { $gte: minPrice }
    };
    if (maxPrice !== Infinity) {
      priceFilter.effectivePrice.$lte = maxPrice;
    }
    pipeline.push({ $match: priceFilter });

    // Filter by stock if requested
    if (inStock) {
      pipeline.push({ $match: { totalStock: { $gt: 0 } } });
    }

    // Get count for pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Product.aggregate(countPipeline);
    const totalProducts = countResult[0] ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalProducts / limit);

    // Apply sort stage
    let sortOption = { createdAt: -1 };
    if (sort === "priceAsc") sortOption = { effectivePrice: 1 };
    else if (sort === "priceDesc") sortOption = { effectivePrice: -1 };
    else if (sort === "az") sortOption = { name: 1 };
    else if (sort === "za") sortOption = { name: -1 };

    pipeline.push({ $sort: sortOption });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Populate category field
    pipeline.push(
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" }
    );

    const products = await Product.aggregate(pipeline);

    // Get list of all unique brands belonging to listed categories
    const uniqueBrands = (await Product.distinct("brand", {
      isDeleted: false,
      isListed: true,
      category: { $in: activeCategoryIds }
    })).filter(Boolean);

    res.render("user/products", {
      products,
      categories: activeCategories,
      brands: uniqueBrands,
      currentPage: page,
      totalPages,
      totalProducts,
      search,
      categorySlug,
      sort,
      selectedBrand,
      inStock,
      minPrice: req.query.minPrice || "",
      maxPrice: req.query.maxPrice || "",
      limit
    });
  } catch (error) {
    console.error("Load Products Page Error:", error);
    req.session.error = "Unable to load products";
    res.redirect("/home");
  }
};

// LOAD PRODUCT DETAILS PAGE
export const loadProductDetailsPage = async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await Product.findOne({ slug }).populate("category");

    // Redirect to listings if product is deleted, blocked/unlisted, or category is unlisted
    if (!product || product.isDeleted || !product.isListed || !product.category.isListed) {
      req.session.error = "Product is currently unavailable";
      return res.redirect("/products");
    }

    // Fetch related products of the same category (listed, non-deleted, excluding current product)
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isListed: true,
      isDeleted: false
    })
      .populate("category")
      .limit(4);

    res.render("user/product-details", {
      product,
      relatedProducts,
      category: product.category
    });
  } catch (error) {
    console.error("Load Product Details Page Error:", error);
    req.session.error = "Unable to load product details";
    res.redirect("/products");
  }
};