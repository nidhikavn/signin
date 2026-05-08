const adminService = require("../services/adminService")
const { sendError } = require("./controllerUtils")

async function createAdmin(req, res) {
  try {
    const result = await adminService.createAdmin(req.body)
    return res.status(201).json(result)
  } catch (error) {
    console.error("Create admin error:", error)
    return sendError(res, error, "Could not create admin.")
  }
}

async function createEmployeeWithCredentials(req, res) {
  try {
    const result = await adminService.createEmployeeWithCredentials(req.body)
    return res.status(201).json(result)
  } catch (error) {
    console.error("Admin create-employee error:", error)
    return sendError(res, error, "Could not create employee.")
  }
}

module.exports = {
  createAdmin,
  createEmployeeWithCredentials,
}
