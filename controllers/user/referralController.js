import User from "../../models/User.js";
import WalletTransaction from "../../models/walletTransaction.js";
import Offer from "../../models/offer.js";

// Generate unique referral code for user
export const generateReferralCode = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.referralCode) {
      const randomCode = "REF-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      user.referralCode = randomCode;
      await user.save();
    }
    const refUrl = `${req.protocol}://${req.get("host")}/signup?ref=${user.referralCode}`;
    res.status(200).json({ success: true, referralCode: user.referralCode, referralUrl: refUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error generating referral information." });
  }
};

// Registration Signup Hook (To run when a user registers)
export const handleReferralSignup = async (newUserId, referralCode) => {
  try {
    if (!referralCode) return;
    const referrer = await User.findOne({ referralCode });
    if (!referrer) return;

    // Link Referee to Referrer
    const referee = await User.findById(newUserId);
    referee.referredBy = referrer._id;
    await referee.save();

    // Fetch active referral configurations
    const referralOffer = await Offer.findOne({ targetType: "referral", isActive: true });
    
    // Defaults: Referrer gets ₹100, Referee gets ₹50 if no specific offer is active
    const referrerReward = referralOffer ? referralOffer.referralReward.referrerAmount : 100;
    const refereeReward = referralOffer ? referralOffer.referralReward.refereeAmount : 50;

    // Credit Referrer Wallet
    referrer.walletBalance = (referrer.walletBalance || 0) + referrerReward;
    await referrer.save();
    await WalletTransaction.create({
      userId: referrer._id,
      amount: referrerReward,
      type: "credit",
      description: `Referral Reward: Invited new user ${referee.name}`
    });

    // Credit Referee Wallet
    referee.walletBalance = (referee.walletBalance || 0) + refereeReward;
    await referee.save();
    await WalletTransaction.create({
      userId: referee._id,
      amount: refereeReward,
      type: "credit",
      description: `Referral Sign-up Reward (Referred by ${referrer.name})`
    });
  } catch (error) {
    console.error("Referral rewards credit failed:", error);
  }
};
