const express = require("express")
const adminController = require("../controllers/adminController")

const router = express.Router()

router.post("/admins", adminController.createAdmin)
router.post("/createemployee", adminController.createEmployeeWithCredentials)

module.exports = router
