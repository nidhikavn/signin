const express = require("express")
const employeeController = require("../controllers/employeeController")

const router = express.Router()

router.get("/employees", employeeController.listEmployees)
router.post("/employees", employeeController.createEmployee)
router.get("/employees/:employeeId", employeeController.getEmployee)
router.put("/employees/:employeeId", employeeController.updateEmployee)
router.delete("/employees/:employeeId", employeeController.deleteEmployee)

module.exports = router
