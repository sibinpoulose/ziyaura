import multer from "multer";

import { CloudinaryStorage }
from "multer-storage-cloudinary";

import cloudinary
from "../config/cloudinary.js";

const storage =
  new CloudinaryStorage({

    cloudinary,

    params: async (
      req,
      file
    ) => ({

      folder:
        "ziyaura_categories",

      format:
        "webp"

    })

  });

const fileFilter = (
  req,
  file,
  cb
) => {

  if (
    file.mimetype.startsWith(
      "image/"
    )
  ) {

    cb(null, true);

  } else {

    cb(
      new Error(
        "Only images are allowed"
      ),
      false
    );

  }

};

const upload = multer({

  storage,

  fileFilter,

  limits: {

    fileSize:
      5 * 1024 * 1024

  }

});

export default upload;