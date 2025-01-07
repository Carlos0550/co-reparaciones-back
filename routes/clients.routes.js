const express = require("express")
const { createClient, verifyAuthCode, loginClientWithEmail, saveClientInfo, getClientInfo, getClientOrders } = require("../controllers/clients.controller")
const Router = express.Router()
const multer = require("multer")

const storage = multer.memoryStorage()
const upload = multer({storage})

Router.post("/new-client", createClient)
Router.put("/verify-auth-code", verifyAuthCode)
Router.put("/login-client", loginClientWithEmail)
Router.post("/save-client-info", upload.none(), saveClientInfo)
Router.get("/retrieve-client-info", getClientInfo)
Router.get("/get-client-orders/:client_id", getClientOrders)

module.exports = Router
