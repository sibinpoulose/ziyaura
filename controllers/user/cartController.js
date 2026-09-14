import {
  getUserCartData,
  addItemToCart,
  updateItemQuantityInCart,
  removeItemFromCart,
  MAX_QTY_LIMIT
} from "../../services/user/cartService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const loadCartPage = async (req, res) => {
  try {
    const data = await getUserCartData(req.user._id);
    res.render("user/cart", data);
  } catch (error) {
    console.error("Load Cart Page Error:", error);
    req.session.error = "Failed to load shopping cart.";
    res.redirect("/home");
  }
};

export const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;
    const result = await addItemToCart(req.user._id, { productId, variantId, quantity });

    if (result.error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: result.error });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Product added to bag successfully.",
      cartCount: result.cartCount
    });
  } catch (error) {
    console.error("Add to Cart Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to add product to bag." });
  }
};

export const updateCartQuantity = async (req, res) => {
  try {
    const { itemId, action } = req.body;
    const result = await updateItemQuantityInCart(req.user._id, { itemId, action });

    if (result.error) {
      const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({ success: false, message: result.error });
    }

    return res.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    console.error("Update Cart Quantity Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to update bag." });
  }
};

export const removeFromCart = async (req, res) => {
  const isJson = req.xhr || req.headers.accept?.includes("application/json");

  try {
    const { id } = req.params;
    const result = await removeItemFromCart(req.user._id, id);

    if (result.error) {
      if (isJson) {
        const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
        return res.status(status).json({ success: false, message: result.error });
      }
      req.session.error = result.error;
      return res.redirect("/cart");
    }

    if (isJson) {
      return res.status(HTTP_STATUS.OK).json({
        ...result,
        message: "Product removed from shopping bag."
      });
    }

    req.session.success = "Product removed from shopping bag.";
    res.redirect("/cart");
  } catch (error) {
    console.error("Remove from Cart Error:", error);
    if (isJson) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: "Failed to remove product from shopping bag." });
    }
    req.session.error = "Failed to remove product from shopping bag.";
    res.redirect("/cart");
  }
};

export { MAX_QTY_LIMIT };
