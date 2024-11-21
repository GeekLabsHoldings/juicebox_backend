const winston = require('winston');

const createLogger = (filename = 'activities.log', level = 'info') => {
  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [new winston.transports.File({ filename: `logs/${filename}` })],
  });
};

// Log specific activities with a consistent format
const logActivity = (type, data) => {
  const logger = createLogger();
  logger.info({ eventType: type, timestamp: new Date().toISOString(), ...data });
};

module.exports = { createLogger, logActivity };
