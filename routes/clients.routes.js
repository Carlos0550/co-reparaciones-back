const express = require("express")
const { createClient, verifyAuthCode, loginClientWithEmail } = require("../controllers/clients.controller")
const Router = express.Router()


Router.post("/new-client/:userEmail", createClient)
Router.put("/verify-auth-code", verifyAuthCode)
Router.put("/login-client/:email", loginClientWithEmail)

module.exports = Router
