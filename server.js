const express = require("express");
require('dotenv').config({ path: "./config/.env" });
const morgan = require("morgan");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const compression = require("compression");
const cookieSession = require("cookie-session");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

const ApiError = require("./utils/apiError");
const globalError = require("./middlewares/errorMiddleware");
const dbConnection = require("./config/database");

// Routes
const mountRoutes = require("./routes");

require("./config/passport");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Connect with db
dbConnection();

// Express app
const app = express();

// Parse JSON requests and URL-encoded data
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Parse cookies
app.use(cookieParser()); // For parsing cookies

// Enable other domains to access your application
app.use(cors());
app.options("*", cors());

// Compress all responses
app.use(compression());

// Initialize cookie-session
app.use(cookieSession({
  name: 'session',
  secret: process.env.COOKIE_SESSION_SECRET,
  maxAge: 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === 'production' // Only send cookies over HTTPS in production
}));

// Initialize Passport and session
app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log(`mode: ${process.env.NODE_ENV}`);
}

// Middleware to protect against HTTP Parameter Pollution attacks
app.use(helmet());

// Middleware to sanitize user input
app.use(mongoSanitize());

// Mount Routes
mountRoutes(app);

app.all("*", (req, res, next) => {
  next(new ApiError(`Can't find this route: ${req.originalUrl}`, 400));
});

// Global error handling middleware for express
app.use(globalError);

const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});

// Handle rejection outside express
process.on("unhandledRejection", (err) => {
  console.error(`UnhandledRejection Errors: ${err.name} | ${err.message}`);
  server.close(() => {
    console.error(`Shutting down....`);
    process.exit(1);
  });
});
