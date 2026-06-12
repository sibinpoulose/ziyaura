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
  // ALLOW ONLY IMAGES

  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(
      new Error("Only image files are allowed"),

      false
    );
  }
};

// MULTER CONFIG

const upload = multer({
  storage,

  fileFilter,

  limits: {
    // 5MB LIMIT

    fileSize: 5 * 1024 * 1024
  }
});

export default upload;
