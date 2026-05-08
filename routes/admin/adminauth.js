import express from "express"
const router=express.Router();
router.get("/dashboard",(req,res)=>{
    req.render("admin/dashboard")
})
export default router;