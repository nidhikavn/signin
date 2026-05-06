# MongoDB Setup Guide

## Installation

### Option 1: Local MongoDB Installation

#### Windows
1. Download MongoDB Community Edition from https://www.mongodb.com/try/download/community
2. Run the installer and follow the setup wizard
3. MongoDB will be installed as a Windows Service and start automatically
4. Verify installation: Open PowerShell and run `mongosh` or `mongo`

#### Mac
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### Linux (Ubuntu)
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

### Option 2: MongoDB Atlas (Cloud)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster
4. Get your connection string (it will look like): `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority`
5. Set the `MONGODB_URL` environment variable with this connection string

### Option 3: Docker

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your MongoDB connection URL if not using the default local instance:
   ```
   MONGODB_URL=mongodb://localhost:27017
   ```

## Installation & Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the backend:
   ```bash
   npm start
   ```

   The server will connect to MongoDB and start listening on port 3000.

## Migration from JSON to MongoDB

Your existing user data from `data/users.json` will NOT be automatically migrated. 

### To migrate your data:

The backend will create a fresh MongoDB database on first run. You can:

1. **Manually re-create users** through the signup endpoint
2. **Use MongoDB shell** to import the data:
   ```bash
   mongoimport --uri "mongodb://localhost:27017/login_db" --collection users --file backend/data/users.json
   ```
3. **Use a migration script** (create one if needed)

## Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,           // MongoDB internal ID
  id: "uuid",              // Application ID
  name: "string",
  email: "string",         // Unique index
  role: "admin" | "user",
  age: number | null,
  salary: number | null,
  salt: "string",
  passwordHash: "string",
  createdAt: "ISO8601 string"
}
```

## Verification

After setup, verify the backend is working:

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# Test signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Troubleshooting

### "Connection refused" error
- Make sure MongoDB is running
- Check `MONGODB_URL` environment variable is correct
- Verify MongoDB is listening on the configured port (default 27017)

### "Authentication failed"
- If using MongoDB Atlas, verify your username and password in the connection string
- Ensure IP whitelist includes your machine's IP

### "Database already exists"
- This is normal - the app will use the existing database
- Data persists between restarts
