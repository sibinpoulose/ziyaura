import Cart from "../../models/Cart.js";
import Product from "../../models/product.js";
import Wishlist from "../../models/Wishlist.js";

export const MAX_QTY_LIMIT = 5;

export const getCartItemDetails = (item) => {
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
    variantDetails = variant.combination.map((c) => `${c.name}: ${c.value}`).join(" | ");
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

export const getUserCartData = async (userId) => {
  let cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    populate: { path: "category" }
  });

  if (!cart) {
    cart = new Cart({ userId, items: [] });
    await cart.save();
  }

  let cartItems = [];
  let cartSubtotal = 0;
  let hasOutOfStockOrInvalid = false;

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

  const shippingCharge = cartSubtotal > 50000 || cartSubtotal === 0 ? 0 : 50;
  const grandTotal = cartSubtotal + shippingCharge;

  return {
    cartItems,
    cartSubtotal,
    shippingCharge,
    grandTotal,
    hasOutOfStockOrInvalid,
    maxQtyLimit: MAX_QTY_LIMIT
  };
};

export const addItemToCart = async (userId, { productId, variantId, quantity: reqQty }) => {
  const qty = parseInt(reqQty) || 1;
  if (qty < 1) {
    return { error: "Invalid quantity." };
  }

  const product = await Product.findOne({ _id: productId, isDeleted: false }).populate("category");
  if (!product || !product.isListed || (product.category && product.category.isListed === false)) {
    return { error: "This product is blocked or unavailable." };
  }

  let price = product.salePrice !== null ? product.salePrice : product.price;
  let stock = product.stock;

  if (variantId) {
    const variant = product.variants.id(variantId);
    if (!variant || !variant.isListed) {
      return { error: "Selected product option is unavailable." };
    }
    price = variant.salePrice !== null ? variant.salePrice : variant.price;
    stock = variant.stock;
  } else {
    if (product.variants && product.variants.length > 0) {
      return { error: "Please select product options." };
    }
  }

  if (stock <= 0) {
    return { error: "This item is currently out of stock." };
  }

  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = new Cart({ userId, items: [] });
  }

  const existingItem = cart.items.find(
    (item) =>
      item.productId.toString() === productId &&
      (!variantId ? !item.variantId : item.variantId?.toString() === variantId)
  );

  if (existingItem) {
    const newQty = existingItem.quantity + qty;
    if (newQty > MAX_QTY_LIMIT) {
      return {
        error: `Maximum limit per product is ${MAX_QTY_LIMIT}. You already have ${existingItem.quantity} in your bag.`
      };
    }
    if (newQty > stock) {
      return {
        error: `Only ${stock} items are available in stock. You already have ${existingItem.quantity} in your bag.`
      };
    }
    existingItem.quantity = newQty;
    existingItem.price = price;
  } else {
    if (qty > MAX_QTY_LIMIT) {
      return { error: `Maximum limit per product is ${MAX_QTY_LIMIT}.` };
    }
    if (qty > stock) {
      return { error: `Only ${stock} items are available in stock.` };
    }
    cart.items.push({
      productId,
      variantId: variantId || null,
      quantity: qty,
      price
    });
  }

  await cart.save();

  await Wishlist.updateOne({ userId }, { $pull: { items: { productId } } });

  const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  return { success: true, cartCount };
};

export const updateItemQuantityInCart = async (userId, { itemId, action }) => {
  if (!itemId || !["increment", "decrement"].includes(action)) {
    return { error: "Invalid update request." };
  }

  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    populate: { path: "category" }
  });

  if (!cart) {
    return { error: "Shopping bag not found.", notFound: true };
  }

  const item = cart.items.id(itemId);
  if (!item) {
    return { error: "Item not found in bag.", notFound: true };
  }

  const details = getCartItemDetails(item);
  if (!details.isValid) {
    return { error: "This item is currently unavailable." };
  }

  let newQty = item.quantity;
  if (action === "increment") {
    newQty += 1;
  } else {
    newQty -= 1;
  }

  if (newQty < 1) {
    return { error: "Quantity cannot be less than 1." };
  }

  if (newQty > MAX_QTY_LIMIT) {
    return { error: `Maximum limit per product is ${MAX_QTY_LIMIT} items.` };
  }

  if (action === "increment" && newQty > details.stock) {
    return { error: `Only ${details.stock} items are available in stock.` };
  }

  item.quantity = newQty;
  item.price = details.price;
  await cart.save();

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
  const cartCount = cart.items.reduce((total, i) => total + i.quantity, 0);

  return {
    success: true,
    newQty,
    itemTotal,
    cartSubtotal,
    shippingCharge,
    grandTotal,
    hasOutOfStockOrInvalid,
    cartCount
  };
};

export const removeItemFromCart = async (userId, itemId) => {
  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    populate: { path: "category" }
  });

  if (!cart) {
    return { error: "Shopping bag not found.", notFound: true };
  }

  cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
  await cart.save();

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

  return {
    success: true,
    cartItemsLength: cart.items.length,
    cartSubtotal,
    shippingCharge,
    grandTotal,
    hasOutOfStockOrInvalid,
    cartCount
  };
};
