const crypto = require("crypto")
const express = require("express")
const fs = require("fs/promises")
const path = require("path")

const app = express()
const port = process.env.PORT || 3000
const dataDir = path.join(__dirname, "data")
const usersFile = path.join(dataDir, "users.json")

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

async function ensureDatabase() {
	try {
		await fs.access(usersFile)
	} catch {
		await fs.mkdir(dataDir, { recursive: true })
		await fs.writeFile(usersFile, "[]\n", "utf8")
	}
}

async function readUsers() {
	await ensureDatabase()

	const content = await fs.readFile(usersFile, "utf8")

	if (!content.trim()) {
		return []
	}

	try {
		const users = JSON.parse(content)
		return Array.isArray(users) ? users : []
	} catch {
		return []
	}
}

async function writeUsers(users) {
	await fs.mkdir(dataDir, { recursive: true })
	await fs.writeFile(usersFile, `${JSON.stringify(users, null, 2)}\n`, "utf8")
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

		const users = await readUsers()
		const existingUser = users.find((user) => user.email === email)

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

		users.push(user)
		await writeUsers(users)

		return res.status(201).json({
			message: "Account created successfully.",
			user: sanitizeUser(user),
		})
	} catch (error) {
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

		const users = await readUsers()
		const user = users.find((entry) => entry.email === email)

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
		return res.status(500).json({ message: "Could not log in right now." })
	}
})

app.get("/api/profile/:userId", async (req, res) => {
	try {
		const { userId } = req.params
		const users = await readUsers()
		const user = users.find((u) => u.id === userId)

		if (!user) {
			return res.status(404).json({ message: "User not found." })
		}

		return res.json({ user: sanitizeUser(user) })
	} catch (error) {
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

		const users = await readUsers()
		const userIndex = users.findIndex((u) => u.id === userId)

		if (userIndex === -1) {
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

		// Update user
		if (name !== undefined) users[userIndex].name = String(name).trim()
		if (age !== undefined) users[userIndex].age = age
		if (salary !== undefined) users[userIndex].salary = salary

		await writeUsers(users)

		return res.json({
			message: "Profile updated successfully.",
			user: sanitizeUser(users[userIndex]),
		})
	} catch (error) {
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

		const users = await readUsers()
		const baseEmail = `${name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ".")
			.replace(/^\.+|\.+$/g, "") || "employee"}`
		let email = `${baseEmail}@employee.local`
		let sequence = 1
		while (users.some((user) => user.email === email)) {
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

		users.push(user)
		await writeUsers(users)

		return res.status(201).json({
			message: "Employee created successfully.",
			user: sanitizeUser(user),
		})
	} catch (error) {
		return res.status(500).json({ message: "Could not create employee right now." })
	}
})

app.get("/api/employees", async (req, res) => {
  try {
    const users = await readUsers()
    const employees = users.filter((user) => user.role !== "admin").map(sanitizeUser)
    return res.json({ employees })
  } catch (error) {
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

		const users = await readUsers()
		const userIndex = users.findIndex((user) => user.id === userId)

		if (userIndex === -1) {
			return res.status(404).json({ message: "User not found." })
		}

		if (users[userIndex].role === "admin") {
			return res.status(403).json({ message: "Admin users cannot be deleted." })
		}

		const deletedUser = users.splice(userIndex, 1)[0]
		await writeUsers(users)

		return res.json({
			message: "Employee deleted successfully.",
			user: sanitizeUser(deletedUser),
		})
	} catch (error) {
		return res.status(500).json({ message: "Could not delete employee right now." })
	}
})
app.listen(port, () => {
	console.log(`app listening on port ${port}`)
})
