import app from "./app.js"
import connectDB from "./config/db.js"
import dotenv from "dotenv"
dotenv.config()
connectDB();
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`)
})