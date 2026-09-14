import { getOrCreateReferralCode, handleReferralSignup } from "../../services/user/referralService.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export const generateReferralCode = async (req, res) => {
  try {
    const data = await getOrCreateReferralCode(req.user._id, req.protocol, req.get("host"));
    res.status(HTTP_STATUS.OK).json({ success: true, ...data });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: "Error generating referral information." 
    });
  }
};

export { handleReferralSignup };
