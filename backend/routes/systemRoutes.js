const express = require("express")

const router = express.Router()

router.get("/", (req, res) => {
  res.json({ message: "Login backend is running." })
})

router.get("/health", (req, res) => {
  res.json({ ok: true })
})

module.exports = router
