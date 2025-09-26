require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// --- Middleware ---
// Enables CORS for all requests, fixing the browser error
app.use(cors());
// Parses incoming JSON requests
app.use(express.json());

// --- Environment Variables ---
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/lavorotrack";

// --- Database Connection ---
mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB connected successfully."))
    .catch(err => console.error("MongoDB connection error:", err));

// --- Route Imports ---
const authRoutes = require("./routes/auth.routes.js");
const kioskRoutes = require("./routes/kiosk.routes.js");
const userRoutes = require("./routes/user.routes.js");
const employeeRoutes = require("./routes/employee.routes.js");
const clientRoutes = require("./routes/client.routes.js");
const projectRoutes = require("./routes/project.routes.js");
const holidayRoutes = require("./routes/holiday.routes.js");
const leaveRoutes = require("./routes/leave.routes.js");
const timesheetRoutes = require("./routes/timesheet.routes.js");

// --- API Endpoints ---
app.use("/api/auth", authRoutes);
app.use("/api/kiosks", kioskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/timesheets", timesheetRoutes);

// --- Root Route for Health Check ---
app.get("/", (req, res) => {
    res.send("Lavoro Track API is running.");
});

// --- Start Server ---
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));