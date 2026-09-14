import { getUserProductsCatalog, getProductDetailsData } from "../../services/user/productService.js";

export const loadProductsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const search = req.query.search || "";
    const categorySlug = req.query.category || "";
    const sort = req.query.sort || "newest";
    const selectedBrand = req.query.brand || "";
    const inStock = req.query.inStock === "true";
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || Infinity;
    const userId = req.user ? req.user._id : null;

    const catalogData = await getUserProductsCatalog({
      page,
      limit,
      search,
      categorySlug,
      sort,
      selectedBrand,
      inStock,
      minPrice,
      maxPrice,
      userId
    });

    res.render("user/products", {
      ...catalogData,
      search,
      categorySlug,
      sort,
      selectedBrand,
      inStock,
      minPrice: req.query.minPrice || "",
      maxPrice: req.query.maxPrice || ""
    });
  } catch (error) {
    console.error("Load Products Page Error:", error);
    req.session.error = "Unable to load products";
    res.redirect("/home");
  }
};

export const loadProductDetailsPage = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user ? req.user._id : null;

    const data = await getProductDetailsData(slug, userId);
    if (!data) {
      req.session.error = "Product not found";
      return res.redirect("/products");
    }

    res.render("user/product-details", data);
  } catch (error) {
    console.error("Load Product Details Page Error:", error);
    req.session.error = "Unable to load product details";
    res.redirect("/products");
  }
};