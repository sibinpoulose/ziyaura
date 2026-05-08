import User from "../../models/User.js";
import Address from "../../models/address.js";
import { sendMail } from "../../utils/mail.js";
import { generateOTP } from "../../utils/otp.js";
import { comparePassword }
  from "../../utils/hash.js";

import { hashPassword }
  from "../../utils/hash.js";



// LOAD PROFILE PAGE
export const loadProfile = async (req, res) => {

  try {

    const user = await User.findById(req.user._id);

    const addresses = await Address.find({
      userId: req.user._id
    });

    res.render("user/profile", {

      user,
      addresses,
      passwordMessage: null,
      scrollToPassword: false

    });

  } catch (err) {

    console.log(err);

    res.redirect("/");

  }

};



// UPDATE ACCOUNT
export const updateAccount = async (req, res) => {

  try {

    const {

      name,
      email,
      phone

    } = req.body;


    const user = await User.findById(req.user._id);


    // EMAIL NOT CHANGED

    if (email === user.email) {

      await User.findByIdAndUpdate(

        req.user._id,

        {

          name,
          phone

        }

      );

      return res.redirect("/profile");

    }


    // EMAIL CHANGED

    const existingUser = await User.findOne({

      email

    });

    if (existingUser) {

      return res.send("Email already exists");

    }


    // GENERATE OTP

    const otp = generateOTP();

    // console.log(otp)
    // SAVE TEMPORARY DATA IN SESSION

    req.session.profileOtp = otp;

    req.session.profileOtpExpiry =
      Date.now() + 5 * 60 * 1000;

    req.session.pendingProfile = {

      name,
      email,
      phone

    };


    // SEND MAIL

    await sendMail(email, otp);


    console.log("PROFILE OTP:", otp);


    // OPEN OTP PAGE

    res.render("user/profile-otp", {

      email,
      message: null

    });

  } catch (err) {

    console.log(err);

    res.redirect("/profile");

  }

};
// VERIFY PROFILE OTP
export const verifyProfileOtp = async (req, res) => {

  try {

    const { otp } = req.body;


    // GET SESSION DATA

    const sessionOtp =
      req.session.profileOtp;

    const expiry =
      req.session.profileOtpExpiry;

    const pendingProfile =
      req.session.pendingProfile;


    // CHECK OTP EXISTS

    if (!sessionOtp) {

      return res.render("user/profile-otp", {

        email: pendingProfile?.email,

        message: "OTP not found"

      });

    }


    // CHECK OTP MATCH

    if (otp !== sessionOtp) {

      return res.render("user/profile-otp", {

        email: pendingProfile?.email,

        message: "Invalid OTP"

      });

    }


    // CHECK OTP EXPIRY

    if (Date.now() > expiry) {

      return res.render("user/profile-otp", {

        email: pendingProfile?.email,

        message: "OTP expired"

      });

    }


    // UPDATE USER FINALLY

    await User.findByIdAndUpdate(

      req.user._id,

      {

        name: pendingProfile.name,

        email: pendingProfile.email,

        phone: pendingProfile.phone

      }

    );


    // CLEAR SESSION

    req.session.profileOtp = null;

    req.session.profileOtpExpiry = null;

    req.session.pendingProfile = null;


    // REDIRECT

    res.redirect("/profile");


  } catch (err) {

    console.log(err);

    res.redirect("/profile");

  }

};

// LOAD ADDRESS PAGE
export const loadAddressPage = async (req, res) => {

  try {

    const addresses = await Address.find({

      userId: req.user._id

    });

    res.render("user/address", {
      addresses
    });

  } catch (err) {

    console.log(err);

    res.redirect("/profile");

  }

};



// LOAD ADD ADDRESS PAGE
export const loadAddAddressPage = (req, res) => {

  res.render("user/add-address");

};



// ADD ADDRESS
export const addAddress = async (req, res) => {

  try {

    const {

      fullName,
      phone,
      address,
      landmark,
      city,
      state,
      pincode,
      addressType,
      isDefault

    } = req.body;


    // REMOVE OLD DEFAULT

    if (isDefault === "on") {

      await Address.updateMany(

        {
          userId: req.user._id
        },

        {
          $set: {
            isDefault: false
          }
        }

      );

    }


    // CHECK EXISTING ADDRESS

    const existingAddress = await Address.findOne({

      userId: req.user._id

    });


    // CREATE ADDRESS

    await Address.create({

      userId: req.user._id,

      fullName,
      phone,
      address,
      landmark,
      city,
      state,
      pincode,

      addressType,

      isDefault:

        existingAddress
          ? isDefault === "on"
          : true

    });


    res.redirect("/profile/address");

  } catch (err) {

    console.log(err);

    res.redirect("/profile/address");

  }

};



// LOAD EDIT ADDRESS PAGE
export const loadEditAddressPage = async (req, res) => {

  try {

    const address = await Address.findOne({

      _id: req.params.id,
      userId: req.user._id

    });

    if (!address) {

      return res.redirect("/profile/address");

    }

    res.render("user/edit-address", {
      address
    });

  } catch (err) {

    console.log(err);

    res.redirect("/profile/address");

  }

};



// UPDATE ADDRESS
export const updateAddress = async (req, res) => {

  try {

    const {

      fullName,
      phone,
      address,
      landmark,
      city,
      state,
      pincode,
      addressType,
      isDefault

    } = req.body;


    // REMOVE PREVIOUS DEFAULT

    if (isDefault === "on") {

      await Address.updateMany(

        {
          userId: req.user._id
        },

        {
          $set: {
            isDefault: false
          }
        }

      );

    }


    // UPDATE ADDRESS

    await Address.findOneAndUpdate(

      {

        _id: req.params.id,
        userId: req.user._id

      },

      {

        fullName,
        phone,
        address,
        landmark,
        city,
        state,
        pincode,

        addressType,

        isDefault: isDefault === "on"

      }

    );

    res.redirect("/profile/address");

  } catch (err) {

    console.log(err);

    res.redirect("/profile/address");

  }

};



// SET DEFAULT ADDRESS
export const setDefaultAddress = async (req, res) => {

  try {

    // REMOVE OLD DEFAULT

    await Address.updateMany(

      {
        userId: req.user._id
      },

      {
        isDefault: false
      }

    );


    // SET NEW DEFAULT

    await Address.findOneAndUpdate(

      {

        _id: req.params.id,
        userId: req.user._id

      },

      {

        isDefault: true

      }

    );

    res.redirect("/profile/address");

  } catch (err) {

    console.log(err);

    res.redirect("/profile/address");

  }

};
// DELETE ADDRESS
export const deleteAddress = async (req, res) => {

  try {

    await Address.findOneAndDelete({

      _id: req.params.id,
      userId: req.user._id

    });

    res.redirect("/profile/address");

  } catch (err) {

    console.log(err);

    res.redirect("/profile/address");

  }

};
// UPDATE PROFILE IMAGE

export const updateProfileImage = async (req, res) => {

  try {

    // CHECK FILE EXISTS

    if (!req.file) {

      return res.redirect("/profile");

    }


    // SAVE CLOUDINARY IMAGE URL

    await User.findByIdAndUpdate(

      req.user._id,

      {

        profileImage: req.file.path

      }

    );


    res.redirect("/profile");

  } catch (err) {

    console.log(err);

    res.redirect("/profile");

  }

};
export const logout = (req, res) => {

  req.session.destroy(() => {

    res.clearCookie("token");

    res.redirect("/login");

  });

};
// CHANGE PASSWORD

export const changePassword = async (req, res) => {

  try {

    const {

      currentPassword,
      newPassword,
      confirmPassword

    } = req.body;


    // GET USER

    const user = await User.findById(
      req.user._id
    );


    // GET ADDRESSES

    const addresses = await Address.find({

      userId: req.user._id

    });


    // CHECK EMPTY

    if (

      !currentPassword ||
      !newPassword ||
      !confirmPassword

    ) {

      return res.render("user/profile", {

        user,

        addresses,

        passwordMessage:
          "ALL FIELDS REQUIRED",

        scrollToPassword: true

      });

    }


    // CHECK PASSWORD MATCH

    if (newPassword !== confirmPassword) {

      return res.render("user/profile", {

        user,

        addresses,

        passwordMessage:
          "Passwords do not match",

        scrollToPassword: true

      });

    }


    // CHECK CURRENT PASSWORD

    const isMatch = await comparePassword(

      currentPassword,

      user.password

    );


    if (!isMatch) {

      return res.render("user/profile", {

        user,

        addresses,

        passwordMessage:
          "CURRENT PASSWORD IS INCORRECT",

        scrollToPassword: true

      });

    }


    // HASH NEW PASSWORD

    const hashedPassword =
      await hashPassword(newPassword);


    // UPDATE PASSWORD

    user.password = hashedPassword;

    await user.save();


    return res.render("user/profile", {

      user,

      addresses,

      passwordMessage:
        "Password changed successfully",

      scrollToPassword: true

    });

  } catch (err) {

    console.log(err);

    res.redirect("/profile");

  }

};