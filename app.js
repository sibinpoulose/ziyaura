import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";

import path from "path";

import { fileURLToPath } from "url";

import cookieParser from "cookie-parser";

import passport from "./config/passport.js";

// ROUTES

import mainRouter from "./routes/index.js";



// MIDDLEWARES

import { attachUser } from "./middlewares/userMiddleware.js";

import { flashMiddleware } from "./middlewares/flashMiddleware.js";

import { noCache } from "./middlewares/noCacheMiddleware.js";

// __DIRNAME

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// APP

const app = express();

// TRUST PROXY (REQUIRED FOR NGINX / PROXY HOSTING)
app.set("trust proxy", 1);

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
    secret: process.env.SESSION_SECRET || "ziyauraSecret",

    resave: false,

    saveUninitialized: false,
    store: MongoStore.create({
   mongoUrl: process.env.MONGO_URI
   }),

    cookie: {
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// PASSPORT

app.use(passport.initialize());

app.use(passport.session());

// ATTACH USER

app.use(attachUser);

// FLASH MESSAGES

app.use(flashMiddleware);

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



app.use("/", mainRouter);

// 404 Page Not Found Handler
app.use((req, res, next) => {
  res.status(404).render("404");
});

// 500 Internal Server Error Handler
app.use((err, req, res, next) => {
  console.error("Internal Error:", err);
  res.status(500).render("500", { error: err.message });
});

export default app;
