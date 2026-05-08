const crypto = require("crypto")
const db = require("../db")
const { Joi, validateSchema } = require("./validation")
const { createHttpError } = require("./httpError")

const adminSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({
    "string.empty": "Name is required.",
    "any.required": "Name is required.",
  }),
  email: Joi.string().trim().email().required().messages({
    "string.email": "Enter a valid email address.",
    "string.empty": "Enter a valid email address.",
    "any.required": "Enter a valid email address.",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters.",
    "string.empty": "Password must be at least 6 characters.",
    "any.required": "Password must be at least 6 characters.",
  }),
  age: Joi.number().min(0).optional().messages({
    "number.base": "Age must be a valid positive number.",
    "number.min": "Age must be a valid positive number.",
  }),
  salary: Joi.number().min(0).optional().messages({
    "number.base": "Salary must be a valid positive number.",
    "number.min": "Salary must be a valid positive number.",
  }),
})

const employeeWithCredentialsSchema = Joi.object({
  currentUserId: Joi.string().trim().required().messages({
    "string.empty": "Unauthorized.",
    "any.required": "Unauthorized.",
  }),
  currentUserRole: Joi.string().trim().required().messages({
    "string.empty": "Unauthorized.",
    "any.required": "Unauthorized.",
  }),
  name: Joi.string().trim().min(1).required().messages({
    "string.empty": "Name is required.",
    "any.required": "Name is required.",
  }),
  email: Joi.string().trim().email().required().messages({
    "string.email": "Enter a valid email address.",
    "string.empty": "Enter a valid email address.",
    "any.required": "Enter a valid email address.",
  }),
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

async function createAdmin(input) {
  const validated = validateSchema(adminSchema, input)
  const name = validated.name
  const email = db.normalizeEmail(validated.email)
  const password = validated.password
  const age = validated.age
  const salary = validated.salary

  const existing = await db.adminsCollection.findOne({ email })
  if (existing) {
    throw createHttpError(409, "An admin with this email already exists.")
  }

  const salt = crypto.randomBytes(16).toString("hex")
  const admin = {
    id: crypto.randomUUID(),
    name,
    email,
    role: "admin",
    salt,
    passwordHash: db.hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  }

  await db.addAdmin(admin)

  return {
    message: "Admin created.",
    admin: { id: admin.id, name: admin.name, email: admin.email },
  }
}

async function createEmployeeWithCredentials(input) {
  const validated = validateSchema(employeeWithCredentialsSchema, input)
  const currentUserId = validated.currentUserId
  const currentUserRole = validated.currentUserRole

  if (currentUserRole !== "admin") {
    throw createHttpError(403, "Admin access required.")
  }

  const callingAdmin = await db.adminsCollection.findOne({ id: currentUserId })
  if (!callingAdmin) {
    throw createHttpError(401, "Invalid admin credentials.")
  }

  const name = validated.name
  const email = db.normalizeEmail(validated.email)
  const age = validated.age
  const salary = validated.salary

  const existingUser = await db.usersCollection.findOne({ email })
  if (existingUser) {
    throw createHttpError(409, "An account with this email already exists.")
  }

  const temporaryPassword = crypto.randomBytes(12).toString("hex")
  const salt = crypto.randomBytes(16).toString("hex")
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    role: "employee",
    age: age ?? null,
    salary: salary ?? null,
    salt,
    passwordHash: db.hashPassword(temporaryPassword, salt),
    createdAt: new Date().toISOString(),
  }

  await db.addUser(user)

  const employee = {
    id: user.id,
    name,
    email,
    role: "employee",
    age: user.age,
    position: validated.position || null,
    salary: user.salary,
    createdAt: user.createdAt,
  }

  await db.addEmployee(employee)

  return {
    message: "Employee created.",
    employee: db.sanitizeEmployee(employee),
    temporaryPassword,
  }
}

module.exports = {
  createAdmin,
  createEmployeeWithCredentials,
}
