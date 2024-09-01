const path = require('path');

const express = require("express");
const dotenv = require('dotenv');
const morgan = require("morgan");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const compression = require("compression");
const session = require("express-session");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const helmet = require("helmet");
const hpp = require('hpp');
dotenv.config({ path: "./config/.env" });

const mongoSanitize = require("express-mongo-sanitize");
const { stripeWebhook } = require("./services/paymentService");
const ApiError = require("./utils/apiError");
const globalError = require("./middlewares/errorMiddleware");
const dbConnection = require("./config/database");

// Routes
const mountRoutes = require("./routes");

// Passport
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

// Checkout webhook
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// Initialize session middleware
app.use(
  session({
    secret: process.env.COOKIE_SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Consider false if you don't want to save uninitialized sessions
    cookie: { secure: process.env.NODE_ENV === "production" }, // Adjust based on your environment
  })
);

// Initialize Passport and session
app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log(`mode: ${process.env.NODE_ENV}`);
}

// Middleware to protect against HTTP Parameter Pollution attacks
app.use(helmet());

app.use(hpp()); // <- THIS IS THE NEW LINE

// Middleware to sanitize user input
app.use(mongoSanitize());

// Welcome route
app.get("/", (req, res) => {
  res.status(200).send({
    success: true,
    message: "Welcome to the API. It is up and running!",
  });
});

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
