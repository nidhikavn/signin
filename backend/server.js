const crypto = require("crypto")
const express = require("express")
const { MongoClient, ObjectId } = require("mongodb")

const app = express()
const port = process.env.PORT || 3000

// MongoDB configuration
const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017"
// Primary DB/collection for auth users
const dbName = process.env.MONGODB_NAME || "login_db"
const collectionName = process.env.USERS_COLLECTION || "users"

// Employee DB/collection (can point to same DB or a separate one)
const employeeDbName = process.env.EMPLOYEE_DB_NAME || dbName
const employeeCollectionName = process.env.EMPLOYEE_COLLECTION || "employees"

let db = null
let usersCollection = null
let employeesCollection = null
let adminsCollection = null

// Connect to MongoDB
async function connectToDatabase() {
	try {
		const client = new MongoClient(mongoUrl)
		await client.connect()
		console.log("Connected to MongoDB")

		// Users collection (auth)
		db = client.db(dbName)
		usersCollection = db.collection(collectionName)
		// Create index on email field for faster lookups
		await usersCollection.createIndex({ email: 1 }, { unique: true })
		await usersCollection.createIndex({ id: 1 })

		// Employees collection (may live in same or different DB)
		const empDb = client.db(employeeDbName)
		employeesCollection = empDb.collection(employeeCollectionName)
		await employeesCollection.createIndex({ id: 1 }, { unique: true })

		// Admins collection (credentials for admins)
		adminsCollection = client.db(dbName).collection(process.env.ADMIN_COLLECTION || "admins")
		await adminsCollection.createIndex({ email: 1 }, { unique: true })
		await adminsCollection.createIndex({ id: 1 })
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
			_id: undefined, 
		}))
	} catch (error) {
		console.error("Error reading users:", error)
		return []
	}
}

// Employees helpers
async function readEmployees() {
	try {
		const employees = await employeesCollection.find({}).toArray()
		return employees.map((e) => ({ ...e, _id: undefined }))
	} catch (error) {
		console.error("Error reading employees:", error)
		return []
	}
}

async function addEmployee(employee) {
	try {
		await employeesCollection.insertOne(employee)
	} catch (error) {
		if (error.code === 11000) {
			throw new Error("Employee ID already exists")
		}
		throw error
	}
}

async function updateEmployee(employeeId, updates) {
	try {
		const result = await employeesCollection.updateOne({ id: employeeId }, { $set: updates })
		return result.modifiedCount > 0
	} catch (error) {
		console.error("Error updating employee:", error)
		throw error
	}
}

async function deleteEmployee(employeeId) {
	try {
		const result = await employeesCollection.deleteOne({ id: employeeId })
		return result.deletedCount > 0
	} catch (error) {
		console.error("Error deleting employee:", error)
		throw error
	}
}

function sanitizeEmployee(emp) {
	return {
		id: emp.id,
		name: emp.name,
		role: emp.role || "employee",
		email: emp.email,
		age: emp.age,
		position: emp.position,
		salary: emp.salary,
		createdAt: emp.createdAt,
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

// Admin helpers
async function addAdmin(admin) {
	try {
		await adminsCollection.insertOne(admin)
	} catch (error) {
		if (error.code === 11000) {
			throw new Error("Admin email already exists")
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

// Admin-only: create employee credentials + employee record
app.post("/api/createemployee", async (req, res) => {
	console.error("ROUTE HIT: /api/createemployee");
	try {
		console.log("CREATE-EMPLOYEE REQUEST BODY:", JSON.stringify(req.body, null, 2))
		const currentUserId = req.body?.currentUserId
		const currentUserRole = req.body?.currentUserRole

		if (!currentUserId || !currentUserRole) return res.status(401).json({ message: "Unauthorized." })
		if (currentUserRole !== "admin") return res.status(403).json({ message: "Admin access required." })

		// Ensure the caller exists in adminsCollection
		const callingAdmin = await adminsCollection.findOne({ id: currentUserId })
		if (!callingAdmin) return res.status(401).json({ message: "Invalid admin credentials." })

		const name = String(req.body?.name || "").trim()
		const email = normalizeEmail(req.body?.email)
		const age = req.body?.age
		const salary = req.body?.salary

		if (!name) return res.status(400).json({ message: "Name is required." })
		if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." })
		if (age !== undefined && age !== null && (typeof age !== "number" || age < 0)) {
			return res.status(400).json({ message: "Age must be a valid positive number." })
		}
		if (salary !== undefined && salary !== null && (typeof salary !== "number" || salary < 0)) {
			return res.status(400).json({ message: "Salary must be a valid positive number." })
		}

		// Create credential in usersCollection with role employee
		const existingUser = await usersCollection.findOne({ email })
		if (existingUser) return res.status(409).json({ message: "An account with this email already exists." })

		// Generate temporary password (random 12 chars)
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
			passwordHash: hashPassword(temporaryPassword, salt),
			createdAt: new Date().toISOString(),
		}

		await addUser(user)

		// Create employee record linked by same id
		const employee = {
			id: user.id,
			name,
			email,
			role: "employee",
			age: user.age,
			position: req.body?.position || null,
			salary: user.salary,
			createdAt: user.createdAt,
		}

		await addEmployee(employee)

		return res.status(201).json({ message: "Employee created.", employee: sanitizeEmployee(employee), temporaryPassword })
	} catch (error) {
		console.error("Admin create-employee error:", error)
		return res.status(500).json({ message: "Could not create employee." })
	}
})

// Admin signup (create admin credentials)
app.post("/api/admins", async (req, res) => {
	try {
		console.log("HIT /api/admins ROUTE - body:", JSON.stringify(req.body, null, 2))
		const name = String(req.body?.name || "").trim()
		const email = normalizeEmail(req.body?.email)
		const password = String(req.body?.password || "")
		const age = req.body?.age
		const salary = req.body?.salary

		if (!name) return res.status(400).json({ message: "Name is required." })
		if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." })
		if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." })
		if (age !== undefined && age !== null && (typeof age !== "number" || age < 0)) {
			return res.status(400).json({ message: "Age must be a valid positive number." })
		}
		if (salary !== undefined && salary !== null && (typeof salary !== "number" || salary < 0)) {
			return res.status(400).json({ message: "Salary must be a valid positive number." })
		}

		const existing = await adminsCollection.findOne({ email })
		if (existing) return res.status(409).json({ message: "An admin with this email already exists." })

		const salt = crypto.randomBytes(16).toString("hex")
		const admin = {
			id: crypto.randomUUID(),
			name,
			email,
			role: "admin",
			salt,
			passwordHash: hashPassword(password, salt),
			createdAt: new Date().toISOString(),
		}

		await addAdmin(admin)

		return res.status(201).json({ message: "Admin created.", admin: { id: admin.id, name: admin.name, email: admin.email } })
	} catch (error) {
		console.error("Create admin error:", error)
		if (error.message?.includes("exists")) return res.status(409).json({ message: error.message })
		return res.status(500).json({ message: "Could not create admin." })
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

		// Try admins first
		let user = await adminsCollection.findOne({ email })
		let source = "admins"

		if (!user) {
			user = await usersCollection.findOne({ email })
			source = "users"
		}

		if (!user) {
			return res.status(401).json({ message: "Invalid email or password." })
		}

		const passwordHash = hashPassword(password, user.salt)

		if (passwordHash !== user.passwordHash) {
			return res.status(401).json({ message: "Invalid email or password." })
		}

		const payloadUser = source === "admins" ? { id: user.id, name: user.name, email: user.email, role: "admin" } : sanitizeUser(user)

		return res.json({
			message: "Logged in successfully.",
			user: payloadUser,
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

// Employee routes
app.get("/api/employees", async (req, res) => {
	try {
		const list = await readEmployees()
		return res.json({ employees: list.map(sanitizeEmployee) })
	} catch (error) {
		console.error("Get employees error:", error)
		return res.status(500).json({ message: "Could not fetch employees." })
	}
})

app.post("/api/employees", async (req, res) => {
	try {
		const currentUserId = req.body?.currentUserId
		const currentUserRole = req.body?.currentUserRole

		if (!currentUserId || currentUserRole !== "admin") {
			return res.status(403).json({ message: "Only admin can add employees." })
		}

		const name = String(req.body?.name || "").trim()
		if (!name) return res.status(400).json({ message: "Name is required." })

		const age = req.body?.age
		if (age !== undefined && age !== null && (typeof age !== "number" || age < 0)) {
			return res.status(400).json({ message: "Age must be a valid positive number." })
		}

		const salary = req.body?.salary
		if (salary !== undefined && salary !== null && (typeof salary !== "number" || salary < 0)) {
			return res.status(400).json({ message: "Salary must be a valid positive number." })
		}

		const employee = {
			id: crypto.randomUUID(),
			name,
			role: req.body?.role || "employee",
			email: normalizeEmail(req.body?.email),
			age: age ?? null,
			position: req.body?.position || null,
			salary: salary ?? null,
			createdAt: new Date().toISOString(),
		}

		await addEmployee(employee)
		return res.status(201).json({ employee: sanitizeEmployee(employee) })
	} catch (error) {
		console.error("Add employee error:", error)
		if (error.message?.includes("already exists")) {
			return res.status(409).json({ message: error.message })
		}
		return res.status(500).json({ message: "Could not add employee." })
	}
})

app.get("/api/employees/:employeeId", async (req, res) => {
	try {
		const { employeeId } = req.params
		const emp = await employeesCollection.findOne({ id: employeeId })
		if (!emp) return res.status(404).json({ message: "Employee not found." })
		return res.json({ employee: sanitizeEmployee(emp) })
	} catch (error) {
		console.error("Get employee error:", error)
		return res.status(500).json({ message: "Could not fetch employee." })
	}
})

app.put("/api/employees/:employeeId", async (req, res) => {
	try {
		const currentUserId = req.body?.currentUserId
		const currentUserRole = req.body?.currentUserRole

		if (!currentUserId || currentUserRole !== "admin") {
			return res.status(403).json({ message: "Only admin can update employees." })
		}

		const { employeeId } = req.params
		const updates = {}
		if (req.body.name !== undefined) updates.name = String(req.body.name || "").trim()
		if (req.body.age !== undefined) updates.age = req.body.age
		if (req.body.position !== undefined) updates.position = req.body.position
		if (req.body.salary !== undefined) updates.salary = req.body.salary

		const ok = await updateEmployee(employeeId, updates)
		if (!ok) return res.status(404).json({ message: "Employee not found or no changes." })
		const emp = await employeesCollection.findOne({ id: employeeId })
		return res.json({ employee: sanitizeEmployee(emp) })
	} catch (error) {
		console.error("Update employee error:", error)
		return res.status(500).json({ message: "Could not update employee." })
	}
})

app.delete("/api/employees/:employeeId", async (req, res) => {
	try {
		const currentUserId = req.body?.currentUserId
		const currentUserRole = req.body?.currentUserRole

		if (!currentUserId || currentUserRole !== "admin") {
			return res.status(403).json({ message: "Only admin can delete employees." })
		}

		const { employeeId } = req.params
		const ok = await deleteEmployee(employeeId)
		if (!ok) return res.status(404).json({ message: "Employee not found." })
		return res.json({ message: "Employee deleted." })
	} catch (error) {
		console.error("Delete employee error:", error)
		return res.status(500).json({ message: "Could not delete employee." })
	}
})

app.post("/api/change-password", async (req, res) => {
	try {
		const userId = req.body?.userId
		const currentUserRole = req.body?.currentUserRole
		const oldPassword = String(req.body?.oldPassword || "").trim()
		const newPassword = String(req.body?.newPassword || "").trim()

		if (!userId || !oldPassword || !newPassword) {
			return res.status(400).json({ message: "User ID, old password, and new password are required." })
		}

		if (newPassword.length < 6) {
			return res.status(400).json({ message: "New password must be at least 6 characters." })
		}

		// Find user in usersCollection
		const user = await usersCollection.findOne({ id: userId })
		if (!user) return res.status(404).json({ message: "User not found." })

		// Verify old password
		const storedHash = hashPassword(oldPassword, user.salt)
		if (storedHash !== user.passwordHash) {
			return res.status(401).json({ message: "Current password is incorrect." })
		}

		// Update password
		const newSalt = crypto.randomBytes(16).toString("hex")
		const newHash = hashPassword(newPassword, newSalt)

		await usersCollection.updateOne(
			{ id: userId },
			{ $set: { salt: newSalt, passwordHash: newHash, updatedAt: new Date().toISOString() } }
		)

		return res.json({ message: "Password changed successfully." })
	} catch (error) {
		console.error("Change password error:", error)
		return res.status(500).json({ message: "Could not change password." })
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


// 404 handler
app.use((req, res) => {
	console.log(`404: ${req.method} ${req.path}`)
	res.status(404).json({ message: "Route not found" })
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
