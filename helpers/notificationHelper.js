const Service = require("../models/serviceModel");
const  ApiError = require("../utils/apiError");

// Check if service belongs to the user
const checkServiceOwnership = async (userId) => {
  const service = await Service.findOne({ userId });
  if (!service || !service.userId.equals(userId)) {
    throw new ApiError(
      "This service does not belong to you for authorization",
      403
    );
  }
};

// Check if notification exists in user notifications
const findNotification = (notifications, notificationId) => {
  return notifications.find((notification) =>
    notification._id.equals(notificationId),
  );
};

module.exports = { checkServiceOwnership, findNotification };
