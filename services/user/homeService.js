import Category from "../../models/category.js";

export const getFeaturedCategoriesForHome = async () => {
  let featuredCategories = await Category.find({ isListed: true, isFeatured: true }).limit(4).lean();

  if (featuredCategories.length < 4) {
    const remaining = 4 - featuredCategories.length;
    const featuredIds = featuredCategories.map((c) => c._id);
    const extraCategories = await Category.find({
      isListed: true,
      _id: { $nin: featuredIds }
    })
      .limit(remaining)
      .lean();

    featuredCategories = [...featuredCategories, ...extraCategories];
  }

  return featuredCategories;
};
