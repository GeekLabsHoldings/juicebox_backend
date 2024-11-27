require('dotenv').config({ path: './config/.env' });

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const passport = require('passport');
const helmet = require('helmet');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const redisClient = require('./config/redis');
const {
  rateLimitMiddleware,
} = require('./middlewares/botProtectionMiddleware');
const {
  enhancedBotDetection,
  honeypot,
} = require('./middlewares/botDetectionMiddleware');
const { stripeWebhook } = require('./services/paymentService');
const ApiError = require('./utils/apiError');
const globalError = require('./middlewares/errorMiddleware');
const dbConnection = require('./config/database');
const createAdminUser = require('./utils/createAdminUser');
const mountRoutes = require('./routes');
require('./config/passport');

// Database Connection
dbConnection();

// Initialize Express App
const app = express();
app.set('trust proxy', true);

// Middleware: Security Headers
app.use(helmet());

// Logging Middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  console.log(`Mode: ${process.env.NODE_ENV}`);
}

// app.use(cors({
//   origin: true, // Allow all origins for testing; restrict in production
//   credentials: true,
// }));

// CORS Middleware
const allowlist = process.env.ALLOWLIST ? process.env.ALLOWLIST.split(',') : [];
app.use(
  cors({
    origin: (origin, callback) => {
      if (allowlist.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

// Middleware: Prevent HTTP Parameter Pollution
app.use(hpp());

// Middleware: Compression for Responses
app.use(compression());

// Middleware: Raw Body Parsing for Stripe Webhook
app.post(
  '/stripe-webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook,
);

// Middleware: JSON and Cookie Parsing
app.use(bodyParser.json());
app.use(cookieParser());

// Middleware: Cookie Session Setup
app.use(
  cookieSession({
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    keys: [process.env.COOKIE_SESSION_SECRET],
  }),
);

// Static File Serving
app.use(express.static(path.join(__dirname, 'uploads')));

// Middleware: Custom Middlewares
app.use(enhancedBotDetection);
app.use(honeypot);
app.use(rateLimitMiddleware);

// Middleware: Passport Initialization
app.use(passport.initialize());
app.use(passport.session());

// Middleware: Input Sanitization
app.use(mongoSanitize());

// Root Route
app.get('/', (req, res) => {
  res.status(200).send({
    success: true,
    message: 'Welcome to the API. It is up and running!',
  });
});

// Mount API Routes
mountRoutes(app);

// Handle Undefined Routes
app.all('*', (req, res, next) => {
  next(new ApiError(`Can't find this route: ${req.originalUrl}`, 400));
});

// Global Error Handling Middleware
app.use(globalError);

// Start the Server and Create Admin User
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, async () => {
  console.log(`Server is running on port: ${PORT}`);

  // Ensure an admin user exists
  await createAdminUser();
});

// Graceful Shutdown for Errors and Signals
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.name} | ${err.message}`);
  server.close(() => {
    console.error('Shutting down due to unhandled rejection...');
    redisClient.quit();
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception: ${err.name} | ${err.message}`);
  redisClient.quit();
  process.exit(1);
});

process.on('uncaughtExceptionMonitor', (err) => {
  console.error(`Uncaught Exception: ${err.name} | ${err.message}`);
  redisClient.quit();
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await redisClient.quit();
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await redisClient.quit();
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

module.exports = server;
