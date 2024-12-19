const express = require('express');
const router = express.Router()

const { getCategories, saveCategories, editCategory, getCountProductsWithCategory, deleteCategory } = require("../controllers/categories.controller.js")

router.get("/get-categories", getCategories)
router.post("/save-category", saveCategories)
router.put("/edit-category/:category_id", editCategory)
router.get("/get-count-products-with-category/:category_id", getCountProductsWithCategory)
router.delete("/delete-category/:category_id", deleteCategory)

module.exports = router