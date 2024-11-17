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
  behaviorProtection,
  rateLimitMiddleware,
  honeypot,
} = require('./middlewares/botProtectionMiddleware');
const { stripeWebhook } = require('./services/paymentService');
const ApiError = require('./utils/apiError');
const globalError = require('./middlewares/errorMiddleware');
const dbConnection = require('./config/database');
const createAdminUser = require('./utils/createAdminUser');

// Initialize Passport configuration
require('./config/passport');

// Connect to Database
dbConnection();

// Express App Initialization
const app = express();

// Essential Security Headers
app.use(helmet());

// Logging (for development mode)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  console.log(`Mode: ${process.env.NODE_ENV}`);
}

// CORS Configuration
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

// Middleware to Prevent HTTP Parameter Pollution
app.use(hpp());

// Compression Middleware for Responses
app.use(compression());

// Static File Serving
app.use(express.static(path.join(__dirname, 'uploads')));

// Raw Body Parsing for Stripe Webhook (before JSON body parsing)
app.post(
  '/stripe-webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook,
);

// JSON Parsing, Cookie Parsing, and Session Setup
app.use(bodyParser.json());
app.use(cookieParser());
app.use(
  cookieSession({
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    keys: [process.env.COOKIE_SESSION_SECRET],
  }),
);

// Initialize Passport for Authentication
app.use(passport.initialize());
app.use(passport.session());

// Input Sanitization
app.use(mongoSanitize());

app.use(behaviorProtection);
app.use(rateLimitMiddleware);

// Root Route
app.get('/', (req, res) => {
  res.status(200).send({
    success: true,
    message: 'Welcome to the API. It is up and running!',
  });
});

// Mount Routes
const mountRoutes = require('./routes');
mountRoutes(app);

app.use(honeypot);
app.post('/fake-login', (req, res) => {
  res.status(200).send({ success: true, message: 'Login successful' });
});
app.post('/fake-signup', (req, res) => {
  res.status(200).send({ success: true, message: 'Signup successful' });
});

// Handle Not Found Routes
app.all('*', (req, res, next) => {
  next(new ApiError(`Can't find this route: ${req.originalUrl}`, 400));
});

// Global Error Handler
app.use(globalError);

// Server Initialization with Admin Creation
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, async () => {
  console.log(`Server is running on port: ${PORT}`);

  // Create or verify the existence of an admin user
  await createAdminUser();
});

// Graceful Shutdown and Error Handling
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.name} | ${err.message}`);
  server.close(() => {
    console.error('Shutting down due to unhandled rejection...');
    redisClient.quit();
    process.exit(1);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await redisClient.quit();
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});
