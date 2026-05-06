const crypto = require("crypto")
const express = require("express")
const { MongoClient, ObjectId } = require("mongodb")

const app = express()
const port = process.env.PORT || 3000

// MongoDB configuration
const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017"
const dbName = "login_db"
const collectionName = "users"

let db = null
let usersCollection = null

// Connect to MongoDB
async function connectToDatabase() {
	try {
		const client = new MongoClient(mongoUrl)
		await client.connect()
		console.log("Connected to MongoDB")
		db = client.db(dbName)
		usersCollection = db.collection(collectionName)
		
		// Create index on email field for faster lookups
		await usersCollection.createIndex({ email: 1 }, { unique: true })
		await usersCollection.createIndex({ id: 1 })
	} catch (error) {
		console.error("Failed to connect to MongoDB:", error)
		process.exit(1)
	}
}

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

async function readUsers() {
	try {
		const users = await usersCollection.find({}).toArray()
		return users.map((user) => ({
			...user,
			_id: undefined, // Remove MongoDB's _id field from response
		}))
	} catch (error) {
		console.error("Error reading users:", error)
		return []
	}
}

async function addUser(user) {
	try {
		await usersCollection.insertOne(user)
	} catch (error) {
		if (error.code === 11000) {
			// Duplicate key error (email already exists)
			throw new Error("Email already exists")
		}
		throw error
	}
}

async function updateUser(userId, updates) {
	try {
		const result = await usersCollection.updateOne({ id: userId }, { $set: updates })
		return result.modifiedCount > 0
	} catch (error) {
		console.error("Error updating user:", error)
		throw error
	}
}

async function deleteUser(userId) {
	try {
		const result = await usersCollection.deleteOne({ id: userId })
		return result.deletedCount > 0
	} catch (error) {
		console.error("Error deleting user:", error)
		throw error
	}
}

function normalizeEmail(email) {
	return String(email || "").trim().toLowerCase()
}

function sanitizeUser(user) {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role || "user",
		age: user.age,
		salary: user.salary,
		createdAt: user.createdAt,
	}
}

function hashPassword(password, salt) {
	return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha256").toString("hex")
}

function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

app.get("/", (req, res) => {
	res.json({ message: "Login backend is running." })
})

app.get("/api/health", (req, res) => {
	res.json({ ok: true })
})

app.post("/api/auth/signup", async (req, res) => {
	try {
		const name = String(req.body?.name || "").trim()
		const email = normalizeEmail(req.body?.email)
		const password = String(req.body?.password || "")

		if (!name) {
			return res.status(400).json({ message: "Name is required." })
		}

		if (!isValidEmail(email)) {
			return res.status(400).json({ message: "Enter a valid email address." })
		}

		if (password.length < 6) {
			return res.status(400).json({ message: "Password must be at least 6 characters." })
		}

		const existingUser = await usersCollection.findOne({ email })

		if (existingUser) {
			return res.status(409).json({ message: "An account with this email already exists." })
		}

		const salt = crypto.randomBytes(16).toString("hex")
		const user = {
			id: crypto.randomUUID(),
			name,
			email,
			role: "user",
			age: null,
			salary: null,
			salt,
			passwordHash: hashPassword(password, salt),
			createdAt: new Date().toISOString(),
		}

		await addUser(user)

		return res.status(201).json({
			message: "Account created successfully.",
			user: sanitizeUser(user),
		})
	} catch (error) {
		console.error("Signup error:", error)
		if (error.message === "Email already exists") {
			return res.status(409).json({ message: "An account with this email already exists." })
		}
		return res.status(500).json({ message: "Could not create account right now." })
	}
})

app.post("/api/auth/login", async (req, res) => {
	try {
		const email = normalizeEmail(req.body?.email)
		const password = String(req.body?.password || "")

		if (!isValidEmail(email)) {
			return res.status(400).json({ message: "Enter a valid email address." })
		}

		if (!password) {
			return res.status(400).json({ message: "Password is required." })
		}

		const user = await usersCollection.findOne({ email })

		if (!user) {
			return res.status(401).json({ message: "Invalid email or password." })
		}

		const passwordHash = hashPassword(password, user.salt)

		if (passwordHash !== user.passwordHash) {
			return res.status(401).json({ message: "Invalid email or password." })
		}

		return res.json({
			message: "Logged in successfully.",
			user: sanitizeUser(user),
		})
	} catch (error) {
		console.error("Login error:", error)
		return res.status(500).json({ message: "Could not log in right now." })
	}
})

app.get("/api/profile/:userId", async (req, res) => {
	try {
		const { userId } = req.params
		const user = await usersCollection.findOne({ id: userId })

		if (!user) {
			return res.status(404).json({ message: "User not found." })
		}

		return res.json({ user: sanitizeUser(user) })
	} catch (error) {
		console.error("Get profile error:", error)
		return res.status(500).json({ message: "Could not fetch profile." })
	}
})

app.put("/api/profile/:userId", async (req, res) => {
	try {
		const { userId } = req.params
		const { name, age, salary } = req.body
		const currentUserId = req.body?.currentUserId
		const currentUserRole = req.body?.currentUserRole

		if (!currentUserId || !currentUserRole) {
			return res.status(401).json({ message: "Unauthorized." })
		}

		// Only admin can update other users, anyone can update their own
		if (currentUserRole !== "admin" && currentUserId !== userId) {
			return res.status(403).json({ message: "You can only update your own profile." })
		}

		const user = await usersCollection.findOne({ id: userId })

		if (!user) {
			return res.status(404).json({ message: "User not found." })
		}

		// Validate name
		if (name !== undefined) {
			const trimmedName = String(name || "").trim()
			if (!trimmedName) {
				return res.status(400).json({ message: "Name cannot be empty." })
			}
		}

		// Validate age and salary
		if (age !== undefined && (typeof age !== "number" || age < 0)) {
			return res.status(400).json({ message: "Age must be a valid positive number." })
		}

		if (salary !== undefined && (typeof salary !== "number" || salary < 0)) {
			return res.status(400).json({ message: "Salary must be a valid positive number." })
		}

		// Prepare updates
		const updates = {}
		if (name !== undefined) updates.name = String(name).trim()
		if (age !== undefined) updates.age = age
		if (salary !== undefined) updates.salary = salary

		await updateUser(userId, updates)

		// Fetch updated user
		const updatedUser = await usersCollection.findOne({ id: userId })

		return res.json({
			message: "Profile updated successfully.",
			user: sanitizeUser(updatedUser),
		})
	} catch (error) {
		console.error("Update profile error:", error)
		return res.status(500).json({ message: "Could not update profile." })
	}
})

app.post("/api/employees", async (req, res) => {
	try {
		const currentUserId = String(req.body?.currentUserId || "")
		const currentUserRole = String(req.body?.currentUserRole || "")
		const name = String(req.body?.name || "").trim()
		const { age, salary } = req.body

		if (!currentUserId || currentUserRole !== "admin") {
			return res.status(403).json({ message: "Only admin can add employees." })
		}

		if (!name) {
			return res.status(400).json({ message: "Name is required." })
		}

		if (age !== undefined && age !== null && (typeof age !== "number" || age < 0)) {
			return res.status(400).json({ message: "Age must be a valid positive number." })
		}

		if (salary !== undefined && salary !== null && (typeof salary !== "number" || salary < 0)) {
			return res.status(400).json({ message: "Salary must be a valid positive number." })
		}

		const baseEmail = `${name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ".")
			.replace(/^\.+|\.+$/g, "") || "employee"}`
		let email = `${baseEmail}@employee.local`
		let sequence = 1
		while (await usersCollection.findOne({ email })) {
			email = `${baseEmail}.${sequence}@employee.local`
			sequence += 1
		}

		const password = crypto.randomBytes(12).toString("hex")

		const salt = crypto.randomBytes(16).toString("hex")
		const user = {
			id: crypto.randomUUID(),
			name,
			email,
			role: "user",
			age: age ?? null,
			salary: salary ?? null,
			salt,
			passwordHash: hashPassword(password, salt),
			createdAt: new Date().toISOString(),
		}

		await addUser(user)

		return res.status(201).json({
			message: "Employee created successfully.",
			user: sanitizeUser(user),
		})
	} catch (error) {
		console.error("Create employee error:", error)
		return res.status(500).json({ message: "Could not create employee right now." })
	}
})

app.get("/api/employees", async (req, res) => {
	try {
		const employees = await usersCollection.find({ role: { $ne: "admin" } }).toArray()
		return res.json({ employees: employees.map(sanitizeUser) })
	} catch (error) {
		console.error("Get employees error:", error)
		return res.status(500).json({ message: "Could not fetch employees." })
	}
})

app.delete("/api/employees/:userId", async (req, res) => {
	try {
		const { userId } = req.params
		const currentUserId = String(req.body?.currentUserId || "")
		const currentUserRole = String(req.body?.currentUserRole || "")

		if (!currentUserId || currentUserRole !== "admin") {
			return res.status(403).json({ message: "Only admin can delete employees." })
		}

		const user = await usersCollection.findOne({ id: userId })

		if (!user) {
			return res.status(404).json({ message: "User not found." })
		}

		if (user.role === "admin") {
			return res.status(403).json({ message: "Admin users cannot be deleted." })
		}

		await deleteUser(userId)

		return res.json({
			message: "Employee deleted successfully.",
			user: sanitizeUser(user),
		})
	} catch (error) {
		console.error("Delete employee error:", error)
		return res.status(500).json({ message: "Could not delete employee right now." })
	}
})

// Start server
async function startServer() {
	try {
		await connectToDatabase()
		app.listen(port, () => {
			console.log(`app listening on port ${port}`)
		})
	} catch (error) {
		console.error("Failed to start server:", error)
		process.exit(1)
	}
}

startServer()
