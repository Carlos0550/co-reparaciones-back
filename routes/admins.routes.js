const express = require("express");
const router = express.Router();
const {registerAdmin, loginAdmin, verifyAdminData, verifyOtp, setAdminPsw, changePsw, sendPurchaseEmails} = require("../controllers/admins.controller.js")
const multer = require("multer");

const storage = multer.memoryStorage()
const upload = multer({storage})

router.get("/verify-admin-data/:user_email", verifyAdminData)
router.get("/verify-admin-otp/:otpCode", verifyOtp)
router.put("/set-admin-psw/:user_email", setAdminPsw)
//router.post("/register-admin", upload.none(), registerUser);
router.post("/login-admin",upload.none(), loginAdmin)
router.put("/change-admin-psw", changePsw)
router.post("/send-purchase-confirmation",upload.none(), sendPurchaseEmails)
module.exports = router