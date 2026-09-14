import Wishlist from "../../models/Wishlist.js";
import Product from "../../models/product.js";

export const getUserWishlistItems = async (userId) => {
  let wishlist = await Wishlist.findOne({ userId }).populate({
    path: "items.productId",
    populate: { path: "category" }
  });

  if (!wishlist) {
    wishlist = new Wishlist({ userId, items: [] });
    await wishlist.save();
  }

  const wishlistItems = [];

  for (const item of wishlist.items) {
    const prod = item.productId;
    if (!prod || prod.isDeleted || !prod.isListed || !prod.category || !prod.category.isListed) {
      continue;
    }

    let price = prod.price;
    let salePrice = prod.salePrice;
    let hasDiscount = false;
    let discountPercent = 0;
    let inStock = false;

    if (prod.variants && prod.variants.length > 0) {
      const listedVariants = prod.variants.filter((v) => v.isListed);
      if (listedVariants.length > 0) {
        const cheapest = listedVariants.reduce((minV, v) => {
          const vPrice = v.salePrice !== null ? v.salePrice : v.price;
          const minPrice = minV.salePrice !== null ? minV.salePrice : minV.price;
          return vPrice < minPrice ? v : minV;
        }, listedVariants[0]);

        price = cheapest.price;
        salePrice = cheapest.salePrice;
        inStock = listedVariants.some((v) => v.stock > 0);
      }
    } else {
      inStock = prod.stock > 0;
    }

    if (salePrice !== null) {
      hasDiscount = true;
      discountPercent = Math.round(((price - salePrice) / price) * 100);
    }

    wishlistItems.push({
      _id: item._id,
      productId: prod._id,
      name: prod.name,
      slug: prod.slug,
      brand: prod.brand,
      image: prod.images && prod.images[0] ? prod.images[0] : "/images/placeholder.jpg",
      price,
      salePrice,
      hasDiscount,
      discountPercent,
      inStock,
      variantsCount: prod.variants ? prod.variants.length : 0,
      variants: prod.variants ? prod.variants.filter((v) => v.isListed) : []
    });
  }

  return wishlistItems;
};

export const addProductToWishlist = async (userId, productId) => {
  if (!productId) {
    return { error: "Product ID is required." };
  }

  const product = await Product.findOne({ _id: productId, isDeleted: false }).populate("category");
  if (!product || !product.isListed || !product.category || !product.category.isListed) {
    return { error: "This product is unavailable." };
  }

  let wishlist = await Wishlist.findOne({ userId });
  if (!wishlist) {
    wishlist = new Wishlist({ userId, items: [] });
  }

  const alreadyExists = wishlist.items.some((item) => item.productId.toString() === productId);
  if (alreadyExists) {
    return { error: "Product is already in your wishlist." };
  }

  wishlist.items.push({ productId });
  await wishlist.save();

  return { success: true, wishlistCount: wishlist.items.length };
};

export const removeProductFromWishlist = async (userId, targetId) => {
  const wishlist = await Wishlist.findOne({ userId });
  if (!wishlist) {
    return { error: "Wishlist not found.", notFound: true };
  }

  wishlist.items = wishlist.items.filter(
    (item) => item._id.toString() !== targetId && item.productId.toString() !== targetId
  );
  await wishlist.save();

  return { success: true, wishlistCount: wishlist.items.length };
};
