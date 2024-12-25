const express = require("express")
const router = express.Router()
// const multer = require("multer")

// const storage = multer.memoryStorage()
// const upload = multer({storage})

const { getSession } = require("../controllers/session.controller.js")


router.get("/retrieve-session-data", getSession)

module.exports = router