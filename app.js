import express from "express";
import session from "express-session";

import path from "path";

import { fileURLToPath } from "url";

import cookieParser from "cookie-parser";

import passport from "./config/passport.js";

// ROUTES

import authRoutes from "./routes/user/authRoutes.js";

import profileRoutes from "./routes/user/profileRoutes.js";

import adminroutes from "./routes/admin/adminauth.js";

import productRoutes from "./routes/user/productRoutes.js";
import cartRoutes from "./routes/user/cartRoutes.js";
import wishlistRoutes from "./routes/user/wishlistRoutes.js";

import Category from "./models/category.js";

// MIDDLEWARES

import { attachUser } from "./middlewares/userMiddleware.js";

import { flashMiddleware } from "./middlewares/flashMiddleware.js";

import { noCache } from "./middlewares/noCacheMiddleware.js";

// __DIRNAME

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// APP

const app = express();

// BODY PARSER

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(express.json());

// COOKIE PARSER

app.use(cookieParser());

// NO CACHE

app.use(noCache);

// SESSION

app.use(
  session({
    secret: "ziyauraSecret",

    resave: false,

    saveUninitialized: false,

    cookie: {
      maxAge: 5 * 60 * 1000
    }
  })
);

// FLASH MESSAGES

app.use(flashMiddleware);

// PASSPORT

app.use(passport.initialize());

app.use(passport.session());

// VIEW ENGINE

app.set(
  "view engine",

  "ejs"
);

app.set(
  "views",

  path.join(__dirname, "views")
);

// STATIC FILES

app.use(express.static("public"));

// ATTACH USER

app.use(attachUser);

// GLOBAL LOCALS

app.use(async (req, res, next) => {
  res.locals.user = req.user || null;

  res.locals.requestPath = req.path;

  try {
    res.locals.categories = await Category.find({ isListed: true });
  } catch (error) {
    res.locals.categories = [];
  }

  next();
});

// ROUTES

app.use("/", authRoutes);
app.use("/", productRoutes);
app.use("/", cartRoutes);
app.use("/", wishlistRoutes);

app.use(
  "/profile",

  profileRoutes
);

app.use(
  "/admin",

  adminroutes
);

export default app;
