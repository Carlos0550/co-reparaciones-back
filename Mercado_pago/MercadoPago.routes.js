const express = require("express")
const router = express.Router()
const multer = require("multer")

const storage = multer.memoryStorage()
const upload = multer({storage})

const { createPayment } = require("./MercadoPago.controller.js")

router.post("/create-payment", upload.none(),createPayment)

module.exports = router