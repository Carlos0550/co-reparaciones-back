const express = require("express");
const router = express.Router();
const multer = require("multer");
const { editPageColors, getPageColors } = require("../controllers/page_colors.controller");

const storage = multer.memoryStorage()
const upload = multer({storage})


router.put("/edit-page-colors", upload.none(), editPageColors)
router.get("/get-page-colors", getPageColors)

module.exports = router