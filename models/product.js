import mongoose from "mongoose";

const productVariantSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    default: null,
    min: 0
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  // combination maps variant type name to its specific value
  // e.g. [{ name: "Size", value: "16" }, { name: "Material", value: "Gold" }]
  combination: [
    {
      name: {
        type: String,
        required: true,
        trim: true
      },
      value: {
        type: String,
        required: true,
        trim: true
      }
    }
  ],
  isListed: {
    type: Boolean,
    default: true
  }
});

const productSchema = new mongoose.Schema(
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
      lowercase: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },
    brand: {
      type: String,
      default: ""
    },
    images: {
      type: [String],
      required: true,
      validate: [
        {
          validator: function(val) {
            return val.length >= 3;
          },
          message: "Product must have at least 3 images"
        }
      ]
    },
    variants: [productVariantSchema],
    // Fallback fields when product has no variants
    price: {
      type: Number,
      required: function() {
        return this.variants && this.variants.length === 0;
      },
      min: 0
    },
    salePrice: {
      type: Number,
      default: null,
      min: 0
    },
    stock: {
      type: Number,
      required: function() {
        return this.variants && this.variants.length === 0;
      },
      min: 0,
      default: 0
    },
    sku: {
      type: String,
      required: function() {
        return this.variants && this.variants.length === 0;
      },
      trim: true
    },
    isListed: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Product", productSchema);
