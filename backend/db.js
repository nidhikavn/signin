const crypto = require("crypto")
const { MongoClient } = require("mongodb")

const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017"
const dbName = process.env.MONGODB_NAME || "login_db"
const collectionName = process.env.USERS_COLLECTION || "users"
const employeeDbName = process.env.EMPLOYEE_DB_NAME || dbName
const employeeCollectionName = process.env.EMPLOYEE_COLLECTION || "employees"

let client = null
let usersCollection = null
let employeesCollection = null
let adminsCollection = null

async function connectToDatabase() {
  client = new MongoClient(mongoUrl)
  await client.connect()

  const db = client.db(dbName)
  usersCollection = db.collection(collectionName)
  await usersCollection.createIndex({ email: 1 }, { unique: true })
  await usersCollection.createIndex({ id: 1 })

  const empDb = client.db(employeeDbName)
  employeesCollection = empDb.collection(employeeCollectionName)
  await employeesCollection.createIndex({ id: 1 }, { unique: true })

  adminsCollection = client.db(dbName).collection(process.env.ADMIN_COLLECTION || "admins")
  await adminsCollection.createIndex({ email: 1 }, { unique: true })
  await adminsCollection.createIndex({ id: 1 })
}

async function readUsers() {
  const users = await usersCollection.find({}).toArray()
  return users.map((u) => ({ ...u, _id: undefined }))
}

async function readEmployees() {
  const employees = await employeesCollection.find({}).toArray()
  return employees.map((e) => ({ ...e, _id: undefined }))
}

async function addEmployee(employee) {
  try {
    await employeesCollection.insertOne(employee)
  } catch (error) {
    if (error.code === 11000) throw new Error("Employee ID already exists")
    throw error
  }
}

async function updateEmployee(employeeId, updates) {
  const result = await employeesCollection.updateOne({ id: employeeId }, { $set: updates })
  return result.modifiedCount > 0
}

async function deleteEmployee(employeeId) {
  const result = await employeesCollection.deleteOne({ id: employeeId })
  return result.deletedCount > 0
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
    if (error.code === 11000) throw new Error("Email already exists")
    throw error
  }
}

async function addAdmin(admin) {
  try {
    await adminsCollection.insertOne(admin)
  } catch (error) {
    if (error.code === 11000) throw new Error("Admin email already exists")
    throw error
  }
}

async function updateUser(userId, updates) {
  const result = await usersCollection.updateOne({ id: userId }, { $set: updates })
  return result.modifiedCount > 0
}

async function deleteUser(userId) {
  const result = await usersCollection.deleteOne({ id: userId })
  return result.deletedCount > 0
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

module.exports = {
  connectToDatabase,
  readUsers,
  readEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  sanitizeEmployee,
  addUser,
  addAdmin,
  updateUser,
  deleteUser,
  normalizeEmail,
  sanitizeUser,
  hashPassword,
  isValidEmail,
  get usersCollection() {
    return usersCollection
  },
  get employeesCollection() {
    return employeesCollection
  },
  get adminsCollection() {
    return adminsCollection
  },
}
