const jwt = require("jsonwebtoken");
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET || "secret", { expiresIn: "30d" });
module.exports = generateToken;
