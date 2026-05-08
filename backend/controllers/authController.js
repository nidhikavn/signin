const authService = require("../services/authService")
const { sendError } = require("./controllerUtils")

async function signup(req, res) {
  try {
    const result = await authService.signupUser(req.body)
    return res.status(201).json(result)
  } catch (error) {
    console.error("Signup error:", error)
    return sendError(res, error, "Could not create account right now.")
  }
}

async function login(req, res) {
  try {
    const result = await authService.loginUser(req.body)
    return res.json(result)
  } catch (error) {
    console.error("Login error:", error)
    return sendError(res, error, "Could not log in right now.")
  }
}

async function changePassword(req, res) {
  try {
    const result = await authService.changePassword(req.body)
    return res.json(result)
  } catch (error) {
    console.error("Change password error:", error)
    return sendError(res, error, "Could not change password.")
  }
}

module.exports = {
  signup,
  login,
  changePassword,
}
