import Product from "../../models/product.js";
import Category from "../../models/category.js";
import Wishlist from "../../models/Wishlist.js";

export const getUserProductsCatalog = async ({
  page = 1,
  limit = 9,
  search = "",
  categorySlug = "",
  sort = "newest",
  selectedBrand = "",
  inStock = false,
  minPrice = 0,
  maxPrice = Infinity,
  userId = null
}) => {
  const skip = (page - 1) * limit;

  const activeCategories = await Category.find({ isListed: true }).lean();
  const activeCategoryIds = activeCategories.map((c) => c._id);

  const matchQuery = {
    isDeleted: false,
    isListed: true,
    category: { $in: activeCategoryIds }
  };

  if (categorySlug) {
    const selectedCategory = activeCategories.find((c) => c.slug === categorySlug);
    matchQuery.category = selectedCategory ? selectedCategory._id : null;
  }

  if (selectedBrand) {
    matchQuery.brand = selectedBrand;
  }

  if (search) {
    matchQuery.$or = [
      { name: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } }
    ];
  }

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

  const priceFilter = {
    effectivePrice: { $gte: minPrice }
  };
  if (maxPrice !== Infinity) {
    priceFilter.effectivePrice.$lte = maxPrice;
  }
  pipeline.push({ $match: priceFilter });

  if (inStock) {
    pipeline.push({ $match: { totalStock: { $gt: 0 } } });
  }

  const countPipeline = [...pipeline, { $count: "total" }];
  const countResult = await Product.aggregate(countPipeline);
  const totalProducts = countResult[0] ? countResult[0].total : 0;
  const totalPages = Math.ceil(totalProducts / limit);

  let sortOption = { createdAt: -1 };
  if (sort === "priceAsc") sortOption = { effectivePrice: 1 };
  else if (sort === "priceDesc") sortOption = { effectivePrice: -1 };
  else if (sort === "az") sortOption = { name: 1 };
  else if (sort === "za") sortOption = { name: -1 };

  pipeline.push({ $sort: sortOption });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

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

  const [products, rawBrands, wishlist] = await Promise.all([
    Product.aggregate(pipeline),
    Product.distinct("brand", {
      isDeleted: false,
      isListed: true,
      category: { $in: activeCategoryIds }
    }),
    userId ? Wishlist.findOne({ userId }).lean() : null
  ]);

  const uniqueBrands = rawBrands.filter(Boolean);
  const wishlistProductIds = wishlist ? wishlist.items.map((item) => item.productId.toString()) : [];

  return {
    products,
    categories: activeCategories,
    brands: uniqueBrands,
    currentPage: page,
    totalPages,
    totalProducts,
    limit,
    wishlistProductIds
  };
};

export const getProductDetailsData = async (slug, userId = null) => {
  const product = await Product.findOne({ slug }).populate("category");
  if (!product || product.isDeleted) return null;

  const isBlocked = !product.isListed || (product.category && !product.category.isListed);

  const [relatedProducts, wishlist] = await Promise.all([
    Product.find({
      category: product.category ? product.category._id : null,
      _id: { $ne: product._id },
      isListed: true,
      isDeleted: false
    })
      .populate("category")
      .limit(4)
      .lean(),
    userId ? Wishlist.findOne({ userId }).lean() : null
  ]);

  const isProductInWishlist = wishlist
    ? wishlist.items.some((item) => item.productId.toString() === product._id.toString())
    : false;

  return {
    product,
    relatedProducts,
    category: product.category || { name: "Uncategorized", slug: "" },
    isProductInWishlist,
    isBlocked
  };
};
