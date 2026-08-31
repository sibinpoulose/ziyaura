import Cart from "../../models/Cart.js";
import Product from "../../models/product.js";
import Wishlist from "../../models/Wishlist.js";

const MAX_QTY_LIMIT = 5;

// HELPER: Validate product, category, and variant and return current details
const getCartItemDetails = (item) => {
  const product = item.productId;
  if (!product) {
    return {
      isValid: false,
      reason: "This product is no longer available (deleted).",
      name: "Deleted Product",
      image: null,
      brand: "ZIYAURA",
      slug: ""
    };
  }

  const name = product.name || "Unavailable Product";
  const image = product.images && product.images[0] ? product.images[0] : null;
  const brand = product.brand || "ZIYAURA";
  const slug = product.slug || "";

  if (product.isDeleted) {
    return {
      isValid: false,
      reason: "This product has been deleted.",
      name,
      image,
      brand,
      slug
    };
  }

  if (!product.isListed) {
    return {
      isValid: false,
      reason: "This product is currently unlisted/unavailable.",
      name,
      image,
      brand,
      slug
    };
  }

  if (!product.category || !product.category.isListed) {
    return {
      isValid: false,
      reason: "This product's category is currently unavailable.",
      name,
      image,
      brand,
      slug
    };
  }

  let price = product.salePrice !== null ? product.salePrice : product.price;
  let originalPrice = product.price;
  let stock = product.stock;
  let variantDetails = "";
  let sku = product.sku;

  if (item.variantId) {
    const variant = product.variants.id(item.variantId);
    if (!variant || !variant.isListed) {
      return {
        isValid: false,
        reason: "Selected product option is unavailable.",
        name,
        image,
        brand,
        slug
      };
    }
    price = variant.salePrice !== null ? variant.salePrice : variant.price;
    originalPrice = variant.price;
    stock = variant.stock;
    sku = variant.sku;
    variantDetails = variant.combination.map(c => `${c.name}: ${c.value}`).join(" | ");
  }

  const hasDiscount = price < originalPrice;

  return {
    isValid: true,
    price,
    originalPrice,
    hasDiscount,
    stock,
    variantDetails,
    sku,
    name,
    image,
    slug,
    brand
  };
};

// LOAD CART PAGE
export const loadCartPage = async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id }).populate({
      path: "items.productId",
      populate: { path: "category" }
    });

    if (!cart) {
      cart = new Cart({ userId: req.user._id, items: [] });
      await cart.save();
    }

    let cartItems = [];
    let cartSubtotal = 0;
    let hasOutOfStockOrInvalid = false;

    // Map items to include fresh product/variant details
    for (const item of cart.items) {
      const details = getCartItemDetails(item);
      const isOutOfStock = details.isValid && details.stock === 0;
      const isInsufficientStock = details.isValid && item.quantity > details.stock;

      if (!details.isValid || isOutOfStock || isInsufficientStock) {
        hasOutOfStockOrInvalid = true;
      }

      if (details.isValid) {
        const itemTotal = details.price * item.quantity;
        cartSubtotal += itemTotal;

        cartItems.push({
          _id: item._id,
          productId: item.productId._id,
          variantId: item.variantId,
          quantity: item.quantity,
          details,
          itemTotal,
          isOutOfStock,
          isInsufficientStock
        });
      } else {
        // Blocked / Deleted product
        cartItems.push({
          _id: item._id,
          productId: item.productId ? item.productId._id : null,
          variantId: item.variantId,
          quantity: item.quantity,
          details: { 
            isValid: false, 
            reason: details.reason,
            name: details.name,
            image: details.image,
            brand: details.brand,
            slug: details.slug
          },
          itemTotal: 0,
          isOutOfStock: false,
          isInsufficientStock: false
        });
      }
    }

    const shippingCharge = cartSubtotal > 50000 || cartSubtotal === 0 ? 0 : 50; // Free shipping over 50k
    const grandTotal = cartSubtotal + shippingCharge;

    res.render("user/cart", {
      cartItems,
      cartSubtotal,
      shippingCharge,
      grandTotal,
      hasOutOfStockOrInvalid,
      maxQtyLimit: MAX_QTY_LIMIT
    });
  } catch (error) {
    console.error("Load Cart Page Error:", error);
    req.session.error = "Failed to load shopping cart.";
    res.redirect("/home");
  }
};

// ADD TO CART
export const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity: reqQty } = req.body;
    const qty = parseInt(reqQty) || 1;

    if (qty < 1) {
      return res.status(400).json({ success: false, message: "Invalid quantity." });
    }

    // Fetch product with category populated
    const product = await Product.findOne({ _id: productId, isDeleted: false }).populate("category");
    if (!product || !product.isListed || (product.category && product.category.isListed === false)) {
      return res.status(400).json({ success: false, message: "This product is blocked or unavailable." });
    }

    let price = product.salePrice !== null ? product.salePrice : product.price;
    let stock = product.stock;

    // Check variant details
    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant || !variant.isListed) {
        return res.status(400).json({ success: false, message: "Selected product option is unavailable." });
      }
      price = variant.salePrice !== null ? variant.salePrice : variant.price;
      stock = variant.stock;
    } else {
      // If product has variants, require variantId
      if (product.variants && product.variants.length > 0) {
        return res.status(400).json({ success: false, message: "Please select product options." });
      }
    }

    if (stock <= 0) {
      return res.status(400).json({ success: false, message: "This item is currently out of stock." });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = new Cart({ userId: req.user._id, items: [] });
    }

    // Check if item already in cart
    const existingItem = cart.items.find(item => 
      item.productId.toString() === productId && 
      (!variantId ? !item.variantId : item.variantId?.toString() === variantId)
    );

    if (existingItem) {
      const newQty = existingItem.quantity + qty;
      if (newQty > MAX_QTY_LIMIT) {
        return res.status(400).json({
          success: false,
          message: `Maximum limit per product is ${MAX_QTY_LIMIT}. You already have ${existingItem.quantity} in your bag.`
        });
      }
      if (newQty > stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${stock} items are available in stock. You already have ${existingItem.quantity} in your bag.`
        });
      }
      existingItem.quantity = newQty;
      existingItem.price = price; // Update to latest price
    } else {
      if (qty > MAX_QTY_LIMIT) {
        return res.status(400).json({ success: false, message: `Maximum limit per product is ${MAX_QTY_LIMIT}.` });
      }
      if (qty > stock) {
        return res.status(400).json({ success: false, message: `Only ${stock} items are available in stock.` });
      }
      cart.items.push({
        productId,
        variantId: variantId || null,
        quantity: qty,
        price
      });
    }

    await cart.save();

    // Remove from wishlist if it exists there
    await Wishlist.updateOne(
      { userId: req.user._id },
      { $pull: { items: { productId } } }
    );

    const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

    return res.status(200).json({
      success: true,
      message: "Product added to bag successfully.",
      cartCount
    });
  } catch (error) {
    console.error("Add to Cart Error:", error);
    return res.status(500).json({ success: false, message: "Failed to add product to bag." });
  }
};

// UPDATE CART QUANTITY
export const updateCartQuantity = async (req, res) => {
  try {
    const { itemId, action } = req.body; // action: 'increment' or 'decrement'

    if (!itemId || !['increment', 'decrement'].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid update request." });
    }

    const cart = await Cart.findOne({ userId: req.user._id }).populate({
      path: "items.productId",
      populate: { path: "category" }
    });

    if (!cart) {
      return res.status(404).json({ success: false, message: "Shopping bag not found." });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in bag." });
    }

    const details = getCartItemDetails(item);
    if (!details.isValid) {
      return res.status(400).json({ success: false, message: "This item is currently unavailable." });
    }

    let newQty = item.quantity;
    if (action === 'increment') {
      newQty += 1;
    } else {
      newQty -= 1;
    }

    if (newQty < 1) {
      return res.status(400).json({ success: false, message: "Quantity cannot be less than 1." });
    }

    if (newQty > MAX_QTY_LIMIT) {
      return res.status(400).json({ success: false, message: `Maximum limit per product is ${MAX_QTY_LIMIT} items.` });
    }

    if (action === 'increment' && newQty > details.stock) {
      return res.status(400).json({ success: false, message: `Only ${details.stock} items are available in stock.` });
    }

    // Apply the new quantity
    item.quantity = newQty;
    item.price = details.price; // Keep price synced with latest
    await cart.save();

    // Calculate new bag values to return for AJAX update
    let cartSubtotal = 0;
    let hasOutOfStockOrInvalid = false;

    for (const tempItem of cart.items) {
      const tempDetails = getCartItemDetails(tempItem);
      const isOutOfStock = tempDetails.isValid && tempDetails.stock === 0;
      const isInsufficientStock = tempDetails.isValid && tempItem.quantity > tempDetails.stock;

      if (!tempDetails.isValid || isOutOfStock || isInsufficientStock) {
        hasOutOfStockOrInvalid = true;
      }

      if (tempDetails.isValid) {
        cartSubtotal += tempDetails.price * tempItem.quantity;
      }
    }

    const itemTotal = details.price * newQty;
    const shippingCharge = cartSubtotal > 50000 || cartSubtotal === 0 ? 0 : 50;
    const grandTotal = cartSubtotal + shippingCharge;

    const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

    return res.status(200).json({
      success: true,
      message: "Bag updated.",
      newQty,
      itemTotal,
      cartSubtotal,
      shippingCharge,
      grandTotal,
      hasOutOfStockOrInvalid,
      cartCount
    });
  } catch (error) {
    console.error("Update Cart Quantity Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update bag." });
  }
};

// REMOVE FROM CART
export const removeFromCart = async (req, res) => {
  try {
    const { id } = req.params; // cart item id

    const cart = await Cart.findOne({ userId: req.user._id }).populate({
      path: "items.productId",
      populate: { path: "category" }
    });

    if (!cart) {
      if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.status(404).json({ success: false, message: "Shopping bag not found." });
      }
      req.session.error = "Shopping bag not found.";
      return res.redirect("/cart");
    }

    // Remove the item
    cart.items = cart.items.filter(item => item._id.toString() !== id);
    await cart.save();

    // Recalculate cart figures for JSON response
    let cartSubtotal = 0;
    let hasOutOfStockOrInvalid = false;

    for (const tempItem of cart.items) {
      const details = getCartItemDetails(tempItem);
      const isOutOfStock = details.isValid && details.stock === 0;
      const isInsufficientStock = details.isValid && tempItem.quantity > details.stock;

      if (!details.isValid || isOutOfStock || isInsufficientStock) {
        hasOutOfStockOrInvalid = true;
      }
      if (details.isValid) {
        cartSubtotal += details.price * tempItem.quantity;
      }
    }

    const shippingCharge = cartSubtotal > 50000 || cartSubtotal === 0 ? 0 : 50;
    const grandTotal = cartSubtotal + shippingCharge;
    const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(200).json({
        success: true,
        message: "Product removed from shopping bag.",
        cartItemsLength: cart.items.length,
        cartSubtotal,
        shippingCharge,
        grandTotal,
        hasOutOfStockOrInvalid,
        cartCount
      });
    }

    req.session.success = "Product removed from shopping bag.";
    res.redirect("/cart");
  } catch (error) {
    console.error("Remove from Cart Error:", error);
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(500).json({ success: false, message: "Failed to remove product from shopping bag." });
    }
    req.session.error = "Failed to remove product from shopping bag.";
    res.redirect("/cart");
  }
};
