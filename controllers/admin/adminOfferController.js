import {
  getOffersPageData,
  validateOfferInput,
  createOfferService,
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

    const validationError = validateOfferInput({ name, discountType, discountValue, targetType, expiryDate });
    if (validationError) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: validationError });
    }

    await createOfferService({
      name,
      discountType,
      discountValue,
      targetType,
      productTarget,
      categoryTarget,
      expiryDate
    });

    res.status(HTTP_STATUS.OK).json({ success: true, message: "Offer created successfully." });
  } catch (error) {
    console.error("Create offer error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to create offer." });
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
