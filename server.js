import dotenv from "dotenv";

dotenv.config();

const { default: app } =
  await import("./app.js");

const { default: connectDB } =
  await import("./config/db.js");


connectDB();


const PORT = 3000;

app.listen(PORT, () => {

  console.log(`server running on port ${PORT}`);

});