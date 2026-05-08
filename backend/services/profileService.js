const db = require("../db")
const { Joi, validateSchema } = require("./validation")
const { createHttpError } = require("./httpError")

const profileIdSchema = Joi.object({
  userId: Joi.string().trim().required().messages({
    "string.empty": "User not found.",
    "any.required": "User not found.",
  }),
})

const updateProfileSchema = Joi.object({
  userId: Joi.string().trim().required().messages({
    "string.empty": "Unauthorized.",
    "any.required": "Unauthorized.",
  }),
  currentUserId: Joi.string().trim().required().messages({
    "string.empty": "Unauthorized.",
    "any.required": "Unauthorized.",
  }),
  currentUserRole: Joi.string().trim().required().messages({
    "string.empty": "Unauthorized.",
    "any.required": "Unauthorized.",
  }),
  name: Joi.string().trim().min(1).optional().messages({
    "string.empty": "Name cannot be empty.",
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

async function getProfile(userId) {
  const { userId: targetId } = validateSchema(profileIdSchema, { userId })
  const user = await db.usersCollection.findOne({ id: targetId })

  if (!user) {
    throw createHttpError(404, "User not found.")
  }

  return {
    user: db.sanitizeUser(user),
  }
}

async function updateProfile(input) {
  const validated = validateSchema(updateProfileSchema, input)
  const userId = validated.userId

  const actorId = validated.currentUserId
  const actorRole = validated.currentUserRole
  if (actorRole !== "admin" && actorId !== userId) {
    throw createHttpError(403, "You can only update your own profile.")
  }

  const user = await db.usersCollection.findOne({ id: userId })
  if (!user) {
    throw createHttpError(404, "User not found.")
  }

  const { name, age, salary } = validated

  const updates = {}
  if (name !== undefined) updates.name = name
  if (age !== undefined) updates.age = age
  if (salary !== undefined) updates.salary = salary

  await db.updateUser(userId, updates)

  const updatedUser = await db.usersCollection.findOne({ id: userId })
  return {
    message: "Profile updated successfully.",
    user: db.sanitizeUser(updatedUser),
  }
}

module.exports = {
  getProfile,
  updateProfile,
}
