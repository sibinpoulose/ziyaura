import express from "express";
import session from "express-session";

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

export default app;
