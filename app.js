import express from "express";
import authRoutes from "./routes/authRoutes.js";
import path from "path";
import { fileURLToPath} from "url";
import cookieParser from "cookie-parser";
const __filename=fileURLToPath(import.meta.url)
const __dirname=path.dirname(__filename)

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.set("view engine", "ejs");
app.set("views",path.join(__dirname,"views"))
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

app.use("/", authRoutes);

export default app;