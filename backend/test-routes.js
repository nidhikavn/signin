const express = require('express');

// Create a fresh app
const app = express();

// Add middleware to initialize _router
app.use(express.json());

// Simulate the route registration
app.post("/api/createemployee", async (req, res) => {
	console.log("ROUTE HIT");
	res.json({ ok: true });
})

app.post("/api/admins", async (req, res) => {
	res.json({ ok: true });
})

// Log all routes
function printRoutes(stack, prefix = "") {
	stack.forEach((middleware, i) => {
		if (middleware.route) {
			// It's a route
			console.log(prefix + i + ": ROUTE", Object.keys(middleware.route.methods), middleware.route.path);
		} else if (middleware.name === "router") {
			// It's a router
			console.log(prefix + i + ": ROUTER");
			if (middleware.handle.stack) {
				printRoutes(middleware.handle.stack, prefix + "  ");
			}
		} else {
			console.log(prefix + i + ": MIDDLEWARE", middleware.name);
		}
	});
}

console.log("Express app routes:");
if (app._router && app._router.stack) {
	printRoutes(app._router.stack);
} else {
	console.log("No router found");
}
