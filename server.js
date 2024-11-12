require('dotenv').config({ path: './config/.env' });

const path = require('path');
const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");
const cookieSession = require('cookie-session');
const passport = require('passport');
const helmet = require('helmet');
const hpp = require('hpp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3 } = require('./config/awsConfig');
const redisClient = require('./config/redis');
const mongoSanitize = require('express-mongo-sanitize');
const { stripeWebhook } = require('./services/paymentService');
const ApiError = require('./utils/apiError');
const User = require('./models/userModel');
const globalError = require('./middlewares/errorMiddleware');
const dbConnection = require('./config/database');
const rateLimit = require('express-rate-limit');

// Passport configuration
require('./config/passport');

// Routes
const mountRoutes = require('./routes');

// Database connection
dbConnection();

// Express app
const app = express();

// Security Headers
app.use(helmet());

// Rate limiter to control request load on the server
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Define allowed origins in the allowlist
const allowlist = process.env.ALLOWLIST
  ? process.env.ALLOWLIST.split(',')
  : [];

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Check if the origin is in the allowlist
      if (allowlist.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Compress all responses to improve performance
app.use(compression());

// Stripe webhook requires raw body parsing
app.post(
  '/stripe-webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook
);

// Body parsers for JSON and cookies
app.use(bodyParser.json());
app.use(cookieParser());

// Static file serving
app.use(express.static(path.join(__dirname, 'uploads')));

// Session and cookie configuration
app.use(
  cookieSession({
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    keys: [process.env.COOKIE_SESSION_SECRET],
  })
);

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

// Development logging with Morgan
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  console.log(`Mode: ${process.env.NODE_ENV}`);
}

// Middleware to prevent HTTP Parameter Pollution
app.use(hpp());

// Middleware to sanitize MongoDB queries
app.use(mongoSanitize());

// Welcome route
app.get('/', (req, res) => {
  res.status(200).send({
    success: true,
    message: 'Welcome to the API. It is up and running!',
  });
});

// Mount routes
mountRoutes(app);

// Handle undefined routes
app.all('*', (req, res, next) => {
  next(new ApiError(`Can't find this route: ${req.originalUrl}`, 400));
});

// Global error handling middleware
app.use(globalError);

const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, async () => {
  console.log(`Server is running on port: ${PORT}`);

  // Check if admin user exists, and create if not
  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    try {
      const adminUser = new User({
        firstName: 'New',
        lastName: 'Admin',
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        adminPosition: 'Sales',
        role: 'admin',
        verifyEmail: true,
      });

      const avatarFilePath = path.join(__dirname, 'uploads', 'default-avatar.jpg');

      // Upload default avatar to S3
      const uploadResult = await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `avatars/${Date.now().toString()}_admin_avatar.jpg`,
          Body: fs.createReadStream(avatarFilePath),
          ContentType: 'image/jpeg',
          ACL: 'public-read',
        })
      );

      adminUser.avatar = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/avatars/${Date.now().toString()}_admin_avatar.jpg`;
      adminUser.s3Key = `avatars/${Date.now().toString()}_admin_avatar.jpg`;

      await adminUser.save();
      console.log('Admin user created successfully with avatar.');
    } catch (error) {
      console.error('Error creating admin user:', error);
    }
  } else {
    console.log('Admin user already exists.');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`UnhandledRejection Errors: ${err.name} | ${err.message}`);
  server.close(() => {
    console.error(`Shutting down....`);
    redisClient.quit();
    process.exit(1);
  });
});

// Handle server shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully.');
  server.close(() => {
    redisClient.quit();
    console.log('Redis client disconnected.');
    process.exit(0);
  });
});

// require('dotenv').config({ path: './config/.env' });

// const path = require('path');
// const fs = require('fs');
// const express = require('express');
// const morgan = require('morgan');
// const cors = require('cors');
// const compression = require('compression');
// const bodyParser = require('body-parser');
// const cookieParser = require("cookie-parser");
// const cookieSession = require('cookie-session');
// const passport = require('passport');
// const helmet = require('helmet');
// const hpp = require('hpp');
// const { PutObjectCommand } = require('@aws-sdk/client-s3');
// const { s3 } = require('./config/awsConfig');
// const redisClient = require('./config/redis');
// const mongoSanitize = require('express-mongo-sanitize');
// const { stripeWebhook } = require('./services/paymentService');
// const ApiError = require('./utils/apiError');
// const User = require('./models/userModel');
// const globalError = require('./middlewares/errorMiddleware');
// const dbConnection = require('./config/database');

// // Passport
// require('./config/passport');

// // Routes
// const mountRoutes = require('./routes');

// // Connect with db
// dbConnection();

// // Express app
// const app = express();

// // Cors
// app.use(cors());

// // Compress all responses
// app.use(compression());

// // Checkout webhook
// app.post(
//   '/stripe-webhook',
//   express.raw({ type: 'application/json' }),
//   stripeWebhook,
// );

// app.use(bodyParser.json());
// // app.use(express.json({ limit: "20kb" }));
// app.use(cookieParser());

// // Serve static files
// app.use(express.static(path.join(__dirname, 'uploads')));

// app.use(
//   cookieSession({
//     // 30 days 24 hours 60 minutes 60 seconds 1000 milliseconds for one second
//     maxAge: 30 * 24 * 60 * 60 * 1000,
//     keys: [process.env.COOKIE_SESSION_SECRET],
//   }),
// );

// // Initialize Passport and session
// app.use(passport.initialize());
// app.use(passport.session());

// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
//   console.log(`mode: ${process.env.NODE_ENV}`);
// }

// // Middleware to protect against HTTP Parameter Pollution attacks
// app.use(helmet());

// app.use(hpp()); // <- THIS IS THE NEW LINE

// // Middleware to sanitize user input
// app.use(mongoSanitize());

// // Welcome route
// app.get('/', (req, res) => {
//   res.status(200).send({
//     success: true,
//     message: 'Welcome to the API. It is up and running!',
//   });
// });

// // Mount Routes
// mountRoutes(app);

// app.all('*', (req, res, next) => {
//   next(new ApiError(`Can't find this route: ${req.originalUrl}`, 400));
// });

// // Global error handling middleware for express
// app.use(globalError);

// const PORT = process.env.PORT || 8000;
// const server = app.listen(PORT, async () => {
//   console.log(`Server is running on port: ${PORT}`);

//   // Check if there is any admin user
//   const adminExists = await User.findOne({ role: 'admin' });
//   if (!adminExists) {
//     try {
//       const adminUser = new User({
//         firstName: 'New',
//         lastName: 'Admin',
//         email: process.env.ADMIN_EMAIL,
//         password: process.env.ADMIN_PASSWORD,
//         adminPosition: 'Sales',
//         role: 'admin',
//         verifyEmail: true,
//       });

//       const avatarFilePath = path.join(
//         __dirname,
//         'uploads',
//         'default-avatar.jpg',
//       );

//       // Upload the default avatar image to S3
//       const uploadResult = await s3.send(
//         new PutObjectCommand({
//           Bucket: process.env.AWS_BUCKET_NAME,
//           Key: `avatars/${Date.now().toString()}_admin_avatar.jpg`,
//           Body: fs.createReadStream(avatarFilePath),
//           ContentType: 'image/jpeg',
//           ACL: 'public-read',
//         }),
//       );

//       adminUser.avatar = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/avatars/${Date.now().toString()}_admin_avatar.jpg`;
//       adminUser.s3Key = `avatars/${Date.now().toString()}_admin_avatar.jpg`;

//       await adminUser.save();
//       console.log('Admin user created successfully with avatar.');
//     } catch (error) {
//       console.error('Error creating admin user:', error);
//     }
//   } else {
//     console.log('Admin user already exists.');
//   }
// });

// // Handle rejection outside express
// process.on('unhandledRejection', (err) => {
//   console.error(`UnhandledRejection Errors: ${err.name} | ${err.message}`);
//   server.close(() => {
//     console.error(`Shutting down....`);
//     redisClient.quit();
//     process.exit(1);
//   });
// });

// // Clean up on server shutdown
// process.on('SIGTERM', () => {
//   console.log('SIGTERM received. Shutting down gracefully.');
//   server.close(() => {
//     redisClient.quit();
//     console.log('Redis client disconnected.');
//     process.exit(0);
//   });
// });
