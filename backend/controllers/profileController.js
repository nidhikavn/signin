const profileService = require("../services/profileService")
const { sendError } = require("./controllerUtils")

async function getProfile(req, res) {
  try {
    const result = await profileService.getProfile(req.params.userId)
    return res.json(result)
  } catch (error) {
    console.error("Get profile error:", error)
    return sendError(res, error, "Could not fetch profile.")
  }
}

async function updateProfile(req, res) {
  try {
    const result = await profileService.updateProfile({
      ...req.body,
      userId: req.params.userId,
    })
    return res.json(result)
  } catch (error) {
    console.error("Update profile error:", error)
    return sendError(res, error, "Could not update profile.")
  }
}

module.exports = {
  getProfile,
  updateProfile,
}
