const router = require('express').Router()
const multer = require("multer")

const storage = multer.memoryStorage()
const upload = multer({storage})

const { savePromotion, getPromotions, deletePromotion, editPromotion } = require("../controllers/promotions.controller.js")

router.post("/save-promotion", upload.array("promotion_images"), savePromotion)
router.get("/get-promotions", getPromotions)
router.delete("/delete-promotion/:promotion_id", deletePromotion)
router.put("/edit-promotion/:promotion_id", upload.array("promotion_images"), editPromotion)

module.exports = router