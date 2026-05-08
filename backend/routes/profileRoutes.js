const express = require("express")
const profileController = require("../controllers/profileController")
const authController = require("../controllers/authController")

const router = express.Router()

router.get("/profile/:userId", profileController.getProfile)
router.put("/profile/:userId", profileController.updateProfile)
router.post("/change-password", authController.changePassword)

module.exports = router
