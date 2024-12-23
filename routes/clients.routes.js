const express = require("express")
const { createClient, verifyAuthCode, loginClientWithEmail, saveClientInfo, getClientInfo } = require("../controllers/clients.controller")
const Router = express.Router()
const multer = require("multer")

const storage = multer.memoryStorage()
const upload = multer({storage})

Router.post("/new-client/:userEmail", createClient)
Router.put("/verify-auth-code", verifyAuthCode)
Router.put("/login-client/:email", loginClientWithEmail)
Router.post("/save-client-info", upload.none(), saveClientInfo)
Router.get("/retrieve-client-info", getClientInfo)

module.exports = Router
