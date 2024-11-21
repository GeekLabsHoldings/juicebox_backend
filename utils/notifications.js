const logger = require('./logger');
const { sendEmail } = require('./adminEmail');

module.exports.notifyAdmin = async (ip, reason) => {
  try {
    await sendEmail(
      'admin@example.com',
      `Suspicious activity detected from IP: ${ip}, Reason: ${reason}`,
    );
    logger.info(`Admin notified for IP ${ip}: ${reason}`);
  } catch (error) {
    logger.error(`Failed to notify admin for IP ${ip}: ${error}`);
  }
};
