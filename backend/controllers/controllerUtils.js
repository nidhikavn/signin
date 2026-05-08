function sendError(res, error, fallbackMessage) {
  const statusCode = Number(error?.statusCode || 500)
  const message = error?.message || fallbackMessage
  return res.status(statusCode).json({ message })
}

module.exports = {
  sendError,
}
