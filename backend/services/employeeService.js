const crypto = require("crypto")
const db = require("../db")
const { Joi, validateSchema } = require("./validation")
const { createHttpError } = require("./httpError")

const adminAccessSchema = Joi.object({
  currentUserId: Joi.string().trim().required().messages({
    "string.empty": "Only admin can perform this action.",
    "any.required": "Only admin can perform this action.",
  }),
  currentUserRole: Joi.string().trim().valid("admin").required().messages({
    "any.only": "Only admin can perform this action.",
    "string.empty": "Only admin can perform this action.",
    "any.required": "Only admin can perform this action.",
  }),
})

const createEmployeeSchema = adminAccessSchema.keys({
  name: Joi.string().trim().min(1).required().messages({
    "string.empty": "Name is required.",
    "any.required": "Name is required.",
  }),
  role: Joi.string().trim().default("employee"),
  email: Joi.string().trim().allow("").optional(),
  age: Joi.number().min(0).optional().messages({
    "number.base": "Age must be a valid positive number.",
    "number.min": "Age must be a valid positive number.",
  }),
  salary: Joi.number().min(0).optional().messages({
    "number.base": "Salary must be a valid positive number.",
    "number.min": "Salary must be a valid positive number.",
  }),
  position: Joi.any().optional(),
})

const employeeIdSchema = Joi.object({
  employeeId: Joi.string().trim().required().messages({
    "string.empty": "Employee not found.",
    "any.required": "Employee not found.",
  }),
})

const updateEmployeeSchema = adminAccessSchema.keys({
  employeeId: Joi.string().trim().required().messages({
    "string.empty": "Employee not found or no changes.",
    "any.required": "Employee not found or no changes.",
  }),
  name: Joi.string().trim().min(1).optional().messages({
    "string.empty": "Name is required.",
  }),
  age: Joi.number().min(0).optional().messages({
    "number.base": "Age must be a valid positive number.",
    "number.min": "Age must be a valid positive number.",
  }),
  position: Joi.any().optional(),
  salary: Joi.number().min(0).optional().messages({
    "number.base": "Salary must be a valid positive number.",
    "number.min": "Salary must be a valid positive number.",
  }),
})

const deleteEmployeeSchema = adminAccessSchema.keys({
  employeeId: Joi.string().trim().required().messages({
    "string.empty": "Employee not found.",
    "any.required": "Employee not found.",
  }),
})

async function listEmployees() {
  const employees = await db.readEmployees()
  return {
    employees: employees.map(db.sanitizeEmployee),
  }
}

async function createEmployee(input) {
  const validated = validateSchema(createEmployeeSchema, input)
  const name = validated.name
  const age = validated.age
  const salary = validated.salary

  const employee = {
    id: crypto.randomUUID(),
    name,
    role: validated.role || "employee",
    email: db.normalizeEmail(validated.email),
    age: age ?? null,
    position: validated.position || null,
    salary: salary ?? null,
    createdAt: new Date().toISOString(),
  }

  await db.addEmployee(employee)

  return {
    employee: db.sanitizeEmployee(employee),
  }
}

async function getEmployee(employeeId) {
  const { employeeId: id } = validateSchema(employeeIdSchema, { employeeId })
  const employee = await db.employeesCollection.findOne({ id })

  if (!employee) {
    throw createHttpError(404, "Employee not found.")
  }

  return {
    employee: db.sanitizeEmployee(employee),
  }
}

async function updateEmployee(input) {
  const validated = validateSchema(updateEmployeeSchema, input)
  const employeeId = validated.employeeId
  const updates = {}

  if (validated.name !== undefined) {
    updates.name = validated.name
  }

  if (validated.age !== undefined) {
    updates.age = validated.age
  }

  if (validated.position !== undefined) {
    updates.position = validated.position
  }

  if (validated.salary !== undefined) {
    updates.salary = validated.salary
  }

  const ok = await db.updateEmployee(employeeId, updates)
  if (!ok) {
    throw createHttpError(404, "Employee not found or no changes.")
  }

  const employee = await db.employeesCollection.findOne({ id: employeeId })
  return {
    employee: db.sanitizeEmployee(employee),
  }
}

async function deleteEmployee(input) {
  const { employeeId } = validateSchema(deleteEmployeeSchema, input)
  const ok = await db.deleteEmployee(employeeId)
  if (!ok) {
    throw createHttpError(404, "Employee not found.")
  }

  return {
    message: "Employee deleted.",
  }
}

module.exports = {
  listEmployees,
  createEmployee,
  getEmployee,
  updateEmployee,
  deleteEmployee,
}
