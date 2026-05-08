import session from "express-session";
import express from "express";


import authRoutes from "./routes/user/authRoutes.js";
import profileRoutes from "./routes/user/profileRoutes.js";
import adminroutes from "./routes/admin/adminauth.js"
import passport from "./config/passport.js";
import { flashMiddleware } from "./middlewares/flashMiddleware.js";
import path from "path";
import { fileURLToPath } from "url";

import cookieParser from "cookie-parser";

import { attachUser } from "./middlewares/userMiddleware.js";


const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);


const app = express();


// BODY PARSER

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// COOKIE

app.use(cookieParser());


// SESSION

app.use(session({

  secret: "ziyauraSecret",

  resave: false,

  saveUninitialized: false,

  cookie: {

    maxAge: 5 * 60 * 1000

  }

}));
app.use(flashMiddleware);
app.use(passport.initialize());

app.use(passport.session());


app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

app.use(express.static("public"));


// ATTACH USER

app.use(attachUser);

app.use((req, res, next) => {

  res.locals.user = req.user || null;

  res.locals.requestPath = req.path;

  next();

});


// ROUTES

app.use("/", authRoutes);

app.use("/profile", profileRoutes);

app.use("/admin",adminroutes)


export default app;