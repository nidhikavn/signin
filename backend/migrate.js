#!/usr/bin/env node

/**
 * Migration script to import users from JSON to MongoDB
 * Usage: node migrate.js
 */

const { MongoClient } = require("mongodb")
const fs = require("fs").promises
const path = require("path")

const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017"
const dbName = "login_db"
const collectionName = "users"
const jsonFilePath = path.join(__dirname, "data", "users.json")

async function migrate() {
	let client = null
	try {
		// Read JSON file
		console.log("📂 Reading users from JSON file...")
		const content = await fs.readFile(jsonFilePath, "utf8")
		const users = JSON.parse(content)

		if (!Array.isArray(users) || users.length === 0) {
			console.log("⚠️  No users found in JSON file. Migration skipped.")
			return
		}

		console.log(`✅ Found ${users.length} users to migrate`)

		// Connect to MongoDB
		console.log("🔗 Connecting to MongoDB...")
		client = new MongoClient(mongoUrl)
		await client.connect()
		console.log("✅ Connected to MongoDB")

		const db = client.db(dbName)
		const collection = db.collection(collectionName)

		// Create unique index on email
		await collection.createIndex({ email: 1 }, { unique: true })

		// Merge users into MongoDB without deleting newer documents.
		console.log("📝 Upserting users into MongoDB...")
		let insertedOrUpdated = 0
		for (const user of users) {
			const result = await collection.updateOne(
				{ email: user.email },
				{ $set: user },
				{ upsert: true },
			)

			if (result.upsertedCount > 0 || result.modifiedCount > 0) {
				insertedOrUpdated += 1
			}
		}
		console.log(`✅ Upserted ${insertedOrUpdated} users`)

		// Verify
		const count = await collection.countDocuments()
		console.log(`✅ Verification: Database now contains ${count} users`)
	} catch (error) {
		console.error("❌ Migration failed:", error.message)
		process.exit(1)
	} finally {
		if (client) {
			await client.close()
			console.log("🔌 Disconnected from MongoDB")
		}
	}
}

migrate()
