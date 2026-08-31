import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

// CLOUDINARY STORAGE
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "ziyaura_profiles",
    allowed_formats: ["jpg", "jpeg", "png", "webp"]
  }
});

// FILE FILTER
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// MULTER CONFIG
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

export const handleProfileUpload = (req, res, next) => {
  upload.single("profileImage")(req, res, (err) => {
    if (err) {
      req.session.error = err.message;
      return res.redirect("/profile");
    }
    next();
  });
};

export default upload;
