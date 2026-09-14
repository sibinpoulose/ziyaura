import User from "../../models/User.js";
import WalletTransaction from "../../models/walletTransaction.js";
import Offer from "../../models/offer.js";

export const getOrCreateReferralCode = async (userId, protocol, host) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (!user.referralCode) {
    user.referralCode = "REF-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    await user.save();
  }

  const referralUrl = `${protocol}://${host}/signup?ref=${user.referralCode}`;
  return { referralCode: user.referralCode, referralUrl };
};

export const validateReferralCode = async (referralCode) => {
  if (!referralCode || !referralCode.trim()) return null;
  return await User.findOne({ referralCode: referralCode.trim() });
};

export const handleReferralSignup = async (newUserId, referralCode) => {
  try {
    if (!referralCode) return;
    const referrer = await User.findOne({ referralCode: referralCode.trim() });
    if (!referrer) return;

    const referee = await User.findById(newUserId);
    if (!referee) return;

    referee.referredBy = referrer._id;
    await referee.save();

    const referralOffer = await Offer.findOne({ targetType: "referral", isActive: true });
    const referrerReward = referralOffer?.referralReward?.referrerAmount ?? 100;
    const refereeReward = referralOffer?.referralReward?.refereeAmount ?? 50;

    referrer.walletBalance = (referrer.walletBalance || 0) + referrerReward;
    await referrer.save();
    await WalletTransaction.create({
      userId: referrer._id,
      amount: referrerReward,
      type: "credit",
      description: `Referral Reward: Invited new user ${referee.name}`
    });

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
