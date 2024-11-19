const winston = require('winston');

// Function to create a logger with a dynamic filename and log level
const createLogger = (filename = 'activities.log', level = 'info') => {
  return winston.createLogger({
    level: level, // Use the dynamic level
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({ filename: `logs/${filename}` }),
    ],
  });
};

// Export the logger factory function
module.exports = createLogger;
