import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import passport from "./config/passport.js";
import mainRouter from "./routes/index.js";
import { attachUser } from "./middlewares/userMiddleware.js";
import { flashMiddleware } from "./middlewares/flashMiddleware.js";
import { noCache } from "./middlewares/noCacheMiddleware.js";
import { SESSION_MAX_AGE, HTTP_STATUS } from "./utils/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(noCache);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "ziyauraSecret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI
    }),
    cookie: {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(attachUser);
app.use(flashMiddleware);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static("public"));

app.use("/", mainRouter);

// 404 Page Not Found Handler
app.use((req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).render("404");
});

// 500 Internal Server Error Handler
app.use((err, req, res, next) => {
  console.error("Internal Error:", err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("500", { error: err.message });
});

export default app;
