const express = require("express")
const router  = express.Router()
const multer = require("multer")

const storage = multer.memoryStorage()
const upload = multer({storage})

router.post("/generate-receipt",upload.none(), require("../controllers/../PDFGenerator/PdfGenerator.controller.js").generatePdfReceipt)

module.exports = router

