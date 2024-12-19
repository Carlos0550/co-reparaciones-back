const express = require('express');
const { saveBanner, getBanners, deleteBanner, editBanners } = require('../controllers/banners.controller');
const router = express.Router();
const multer = require('multer')

const storage = multer.memoryStorage()
const upload = multer({storage})

router.post("/save-banner",upload.array("banner_images"), saveBanner)
router.get("/get-banners", getBanners)
router.delete("/delete-banner/:banner_id", deleteBanner)
router.put("/edit-banner/:banner_id", upload.array("banner_images"), editBanners)

module.exports = router