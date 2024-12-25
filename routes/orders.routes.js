const express = require("express");
const router = express.Router();

router.get("/get-orders", require("../controllers/orders.controller.js").getOrders)
router.put("/process-order/:order_id", require("../controllers/orders.controller.js").processOrder)

module.exports = router