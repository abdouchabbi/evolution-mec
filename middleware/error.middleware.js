// middleware/error.middleware.js

// Middleware for handling errors
const errorHandler = (err, req, res, next) => {
    // If the server sent a status code before the error, use it, otherwise default to 500
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        success: false,
        message: err.message || "An unexpected error occurred",
        // Show the stack trace only in development mode (for easier debugging)
        stack: process.env.NODE_ENV === "production" ? null : err.stack
    });
};

// Middleware for 404 (Route not found)
const notFound = (req, res, next) => {
    const error = new Error(`Route not found: ${req.originalUrl}`);
    res.status(404);
    next(error);
};

module.exports = {
    errorHandler,
    notFound
};