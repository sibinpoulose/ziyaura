import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    description: {
      type: String,
      default: ""
    },

    image: {
      type: String,
      default: ""
    },

    seoTitle: {
      type: String,
      default: ""
    },

    seoDescription: {
      type: String,
      default: ""
    },
    variantTypes: [
      {
        name: {
          type: String,
          trim: true
        },
        values: [
          {
            type: String,
            trim: true
          }
        ]
      }
    ],

    isListed: {
      type: Boolean,
      default: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Category", categorySchema);
