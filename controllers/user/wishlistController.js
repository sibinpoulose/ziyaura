import {
  getUserWishlistItems,
  addProductToWishlist,
  removeProductFromWishlist
} from "../../services/user/wishlistService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const loadWishlistPage = async (req, res) => {
  try {
    const wishlistItems = await getUserWishlistItems(req.user._id);
    res.render("user/wishlist", { wishlistItems });
  } catch (error) {
    console.error("Load Wishlist Page Error:", error);
    req.session.error = "Failed to load wishlist.";
    res.redirect("/home");
  }
};

export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const result = await addProductToWishlist(req.user._id, productId);

    if (result.error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: result.error });
    }

    return res
      .status(HTTP_STATUS.OK)
      .json({ success: true, message: "Product added to wishlist successfully." });
  } catch (error) {
    console.error("Add to Wishlist Error:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to add to wishlist." });
  }
};

export const removeFromWishlist = async (req, res) => {
  const isJson = req.headers["accept"]?.includes("application/json") || req.xhr;

  try {
    const { id } = req.params;
    const result = await removeProductFromWishlist(req.user._id, id);

    if (result.error) {
      if (isJson) {
        const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
        return res.status(status).json({ success: false, message: result.error });
      }
      req.session.error = result.error;
      return res.redirect("/wishlist");
    }

    if (isJson) {
      return res.status(HTTP_STATUS.OK).json({ success: true, message: "Product removed from wishlist." });
    }
    req.session.success = "Product removed from wishlist.";
    res.redirect("/wishlist");
  } catch (error) {
    console.error("Remove from Wishlist Error:", error);
    if (isJson) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: "Failed to remove product from wishlist." });
    }
    req.session.error = "Failed to remove product from wishlist.";
    res.redirect("/wishlist");
  }
};
