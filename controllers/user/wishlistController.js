import Wishlist from "../../models/Wishlist.js";
import Product from "../../models/product.js";

// LOAD WISHLIST PAGE
export const loadWishlistPage = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ userId: req.user._id }).populate({
      path: "items.productId",
      populate: { path: "category" }
    });

    if (!wishlist) {
      wishlist = new Wishlist({ userId: req.user._id, items: [] });
      await wishlist.save();
    }

    const wishlistItems = [];

    for (const item of wishlist.items) {
      const prod = item.productId;
      if (!prod || prod.isDeleted || !prod.isListed || !prod.category || !prod.category.isListed) {
        // Automatically clean up deleted/blocked products or just skip displaying
        continue;
      }

      // Compute pricing
      let price = prod.price;
      let salePrice = prod.salePrice;
      let hasDiscount = false;
      let discountPercent = 0;
      let inStock = false;

      if (prod.variants && prod.variants.length > 0) {
        const listedVariants = prod.variants.filter(v => v.isListed);
        if (listedVariants.length > 0) {
          const cheapest = listedVariants.reduce((minV, v) => {
            const vPrice = v.salePrice !== null ? v.salePrice : v.price;
            const minPrice = minV.salePrice !== null ? minV.salePrice : minV.price;
            return vPrice < minPrice ? v : minV;
          }, listedVariants[0]);

          price = cheapest.price;
          salePrice = cheapest.salePrice;
          inStock = listedVariants.some(v => v.stock > 0);
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
        variants: prod.variants ? prod.variants.filter(v => v.isListed) : []
      });
    }

    res.render("user/wishlist", {
      wishlistItems
    });
  } catch (error) {
    console.error("Load Wishlist Page Error:", error);
    req.session.error = "Failed to load wishlist.";
    res.redirect("/home");
  }
};

// ADD TO WISHLIST
export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required." });
    }

    const product = await Product.findOne({ _id: productId, isDeleted: false }).populate("category");
    if (!product || !product.isListed || !product.category || !product.category.isListed) {
      return res.status(400).json({ success: false, message: "This product is unavailable." });
    }

    let wishlist = await Wishlist.findOne({ userId: req.user._id });
    if (!wishlist) {
      wishlist = new Wishlist({ userId: req.user._id, items: [] });
    }

    const alreadyExists = wishlist.items.some(item => item.productId.toString() === productId);
    if (alreadyExists) {
      return res.status(400).json({ success: false, message: "Product is already in your wishlist." });
    }

    wishlist.items.push({ productId });
    await wishlist.save();

    return res.status(200).json({ success: true, message: "Product added to wishlist successfully." });
  } catch (error) {
    console.error("Add to Wishlist Error:", error);
    return res.status(500).json({ success: false, message: "Failed to add to wishlist." });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const { id } = req.params; // Can be item ID or productId

    const wishlist = await Wishlist.findOne({ userId: req.user._id });
    if (!wishlist) {
      if (req.headers['accept']?.includes('application/json') || req.xhr) {
        return res.status(404).json({ success: false, message: "Wishlist not found." });
      }
      req.session.error = "Wishlist not found.";
      return res.redirect("/wishlist");
    }

    wishlist.items = wishlist.items.filter(item => 
      item._id.toString() !== id && item.productId.toString() !== id
    );
    await wishlist.save();

    if (req.headers['accept']?.includes('application/json') || req.xhr) {
      return res.status(200).json({ success: true, message: "Product removed from wishlist." });
    }
    req.session.success = "Product removed from wishlist.";
    res.redirect("/wishlist");
  } catch (error) {
    console.error("Remove from Wishlist Error:", error);
    if (req.headers['accept']?.includes('application/json') || req.xhr) {
      return res.status(500).json({ success: false, message: "Failed to remove product from wishlist." });
    }
    req.session.error = "Failed to remove product from wishlist.";
    res.redirect("/wishlist");
  }
};
