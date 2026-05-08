const crypto = require("crypto")
const db = require("../db")
const { Joi, validateSchema } = require("./validation")
const { createHttpError } = require("./httpError")

const signupSchema = Joi.object({
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
    "string.empty": "Password is required.",
    "any.required": "Password is required.",
  }),
})

const loginSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "string.email": "Enter a valid email address.",
    "string.empty": "Enter a valid email address.",
    "any.required": "Enter a valid email address.",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required.",
    "any.required": "Password is required.",
  }),
})

const changePasswordSchema = Joi.object({
  userId: Joi.string().trim().required().messages({
    "string.empty": "User ID, old password, and new password are required.",
    "any.required": "User ID, old password, and new password are required.",
  }),
  oldPassword: Joi.string().trim().required().messages({
    "string.empty": "User ID, old password, and new password are required.",
    "any.required": "User ID, old password, and new password are required.",
  }),
  newPassword: Joi.string().trim().min(6).required().messages({
    "string.min": "New password must be at least 6 characters.",
    "string.empty": "User ID, old password, and new password are required.",
    "any.required": "User ID, old password, and new password are required.",
  }),
})

async function signupUser(input) {
  const { name, email, password } = validateSchema(signupSchema, input)
  const normalizedEmail = db.normalizeEmail(email)

  const existingUser = await db.usersCollection.findOne({ email: normalizedEmail })
  if (existingUser) {
    throw createHttpError(409, "An account with this email already exists.")
  }

  const salt = crypto.randomBytes(16).toString("hex")
  const user = {
    id: crypto.randomUUID(),
    name,
    email: normalizedEmail,
    role: "user",
    age: null,
    salary: null,
    salt,
    passwordHash: db.hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  }

  await db.addUser(user)

  return {
    message: "Account created successfully.",
    user: db.sanitizeUser(user),
  }
}

async function loginUser(input) {
  const { email, password } = validateSchema(loginSchema, input)
  const normalizedEmail = db.normalizeEmail(email)

  let user = await db.adminsCollection.findOne({ email: normalizedEmail })
  let source = "admins"

  if (!user) {
    user = await db.usersCollection.findOne({ email: normalizedEmail })
    source = "users"
  }

  if (!user) {
    throw createHttpError(401, "Invalid email or password.")
  }

  const passwordHash = db.hashPassword(password, user.salt)
  if (passwordHash !== user.passwordHash) {
    throw createHttpError(401, "Invalid email or password.")
  }

  const payloadUser = source === "admins"
    ? { id: user.id, name: user.name, email: user.email, role: "admin" }
    : db.sanitizeUser(user)

  return {
    message: "Logged in successfully.",
    user: payloadUser,
  }
}

async function changePassword(input) {
  const { userId, oldPassword, newPassword } = validateSchema(changePasswordSchema, input)

  const user = await db.usersCollection.findOne({ id: userId })
  if (!user) {
    throw createHttpError(404, "User not found.")
  }

  const storedHash = db.hashPassword(oldPassword, user.salt)
  if (storedHash !== user.passwordHash) {
    throw createHttpError(401, "Current password is incorrect.")
  }

  const newSalt = crypto.randomBytes(16).toString("hex")
  const newHash = db.hashPassword(newPassword, newSalt)

  await db.usersCollection.updateOne(
    { id: userId },
    { $set: { salt: newSalt, passwordHash: newHash, updatedAt: new Date().toISOString() } }
  )

  return {
    message: "Password changed successfully.",
  }
}

module.exports = {
  signupUser,
  loginUser,
  changePassword,
}
