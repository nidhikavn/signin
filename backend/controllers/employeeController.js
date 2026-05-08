const employeeService = require("../services/employeeService")
const { sendError } = require("./controllerUtils")

async function listEmployees(req, res) {
  try {
    const result = await employeeService.listEmployees()
    return res.json(result)
  } catch (error) {
    console.error("Get employees error:", error)
    return sendError(res, error, "Could not fetch employees.")
  }
}

async function createEmployee(req, res) {
  try {
    const result = await employeeService.createEmployee(req.body)
    return res.status(201).json(result)
  } catch (error) {
    console.error("Add employee error:", error)
    return sendError(res, error, "Could not add employee.")
  }
}

async function getEmployee(req, res) {
  try {
    const result = await employeeService.getEmployee(req.params.employeeId)
    return res.json(result)
  } catch (error) {
    console.error("Get employee error:", error)
    return sendError(res, error, "Could not fetch employee.")
  }
}

async function updateEmployee(req, res) {
  try {
    const result = await employeeService.updateEmployee({
      ...req.body,
      employeeId: req.params.employeeId,
    })
    return res.json(result)
  } catch (error) {
    console.error("Update employee error:", error)
    return sendError(res, error, "Could not update employee.")
  }
}

async function deleteEmployee(req, res) {
  try {
    const result = await employeeService.deleteEmployee({
      ...req.body,
      employeeId: req.params.employeeId,
    })
    return res.json(result)
  } catch (error) {
    console.error("Delete employee error:", error)
    return sendError(res, error, "Could not delete employee.")
  }
}

module.exports = {
  listEmployees,
  createEmployee,
  getEmployee,
  updateEmployee,
  deleteEmployee,
}
