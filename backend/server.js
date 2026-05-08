const express = require("express")
const db = require("./db")

const systemRoutes = require("./routes/systemRoutes")
const authRoutes = require("./routes/authRoutes")
const adminRoutes = require("./routes/adminRoutes")
const employeeRoutes = require("./routes/employeeRoutes")
const profileRoutes = require("./routes/profileRoutes")

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())

app.use((req, res, next) => {
	res.setHeader("Access-Control-Allow-Origin", "*")
	res.setHeader("Access-Control-Allow-Headers", "Content-Type")
	res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")

	if (req.method === "OPTIONS") {
		return res.sendStatus(204)
	}

	next()
})

app.use("/", systemRoutes)
app.use("/api/auth", authRoutes)
app.use("/api", adminRoutes)
app.use("/api", employeeRoutes)
app.use("/api", profileRoutes)

app.use((req, res) => {
	console.log(`404: ${req.method} ${req.path}`)
	res.status(404).json({ message: "Route not found" })
})

async function startServer() {
	try {
		await db.connectToDatabase()
		app.listen(port, () => {
			console.log(`app listening on port ${port}`)
		})
	} catch (error) {
		console.error("Failed to start server:", error)
		process.exit(1)
	}
}

startServer()
