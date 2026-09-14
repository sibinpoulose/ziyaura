import {
  getOffersPageData,
  validateOfferInput,
  createOfferService,
  updateOfferService,
  deleteOfferService,
  recalculatePrices
} from "../../services/admin/offerService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const loadOffersPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";

    const data = await getOffersPageData({ page, limit: 5, search });

    res.render("admin/offers", data);
  } catch (error) {
    console.error("Load offers error:", error);
    req.session.error = "Unable to load offers management page.";
    res.redirect("/admin/dashboard");
  }
};

export const createOffer = async (req, res) => {
  try {
    const { name, discountType, discountValue, targetType, productTarget, categoryTarget, expiryDate } = req.body;

    const validationError = validateOfferInput({
      name,
      discountType,
      discountValue,
      targetType,
      productTarget,
      categoryTarget,
      expiryDate
    });

    if (validationError) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: validationError });
    }

    const result = await createOfferService({
      name,
      discountType,
      discountValue,
      targetType,
      productTarget,
      categoryTarget,
      expiryDate
    });

    if (result.error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: result.error });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, message: "Offer created successfully." });
  } catch (error) {
    console.error("Create offer error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to create offer." });
  }
};

export const updateOffer = async (req, res) => {
  try {
    const { offerId, name, discountType, discountValue, targetType, productTarget, categoryTarget, expiryDate } = req.body;

    if (!offerId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Offer ID is required." });
    }

    const validationError = validateOfferInput({
      name,
      discountType,
      discountValue,
      targetType,
      productTarget,
      categoryTarget,
      expiryDate
    });

    if (validationError) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: validationError });
    }

    const result = await updateOfferService(offerId, {
      name,
      discountType,
      discountValue,
      targetType,
      productTarget,
      categoryTarget,
      expiryDate
    });

    if (result.error) {
      const status = result.notFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, message: "Offer updated successfully." });
  } catch (error) {
    console.error("Update offer error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to update offer." });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    await deleteOfferService(req.params.id);
    res.status(HTTP_STATUS.OK).json({ success: true, message: "Offer deleted." });
  } catch (error) {
    console.error("Delete offer error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to delete offer." });
  }
};

export { recalculatePrices };
