const Joi = require("joi")
const { createHttpError } = require("./httpError")

function validateSchema(schema, input) {
  const result = schema.validate(input, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  })

  if (result.error) {
    const message = result.error.details.map((detail) => detail.message).join(" ")
    throw createHttpError(400, message)
  }

  return result.value
}

module.exports = {
  Joi,
  validateSchema,
}
