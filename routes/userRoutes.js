const express = require("express");
const createMulterStorage = require("../middlewares/multerFileMiddleware");
const {
  getUser,
  getLoggedUserData,
  updateLoggedUserPassword,
  updateLoggedUserData,
  deleteLoggedUserData,
  seenNotification,
  deleteNotification,
  getAllUserNotifications,
  getAllServicesForUser,
  getAllMeetingsForUser,
  getProcessForService,
  deleteAllSeenNotifications,
  getAllServicesProcess,
} = require("../controllers/userController");
const {
  updateLoggedUserValidator,
} = require("../utils/validators/userValidator");

// Create upload configuration for images
const uploadImage = createMulterStorage(
  "avatars",
  ["image/jpeg", "image/png", ".jpg", ".jpeg", ".png"],
  2 * 1024 * 1024
); // 2 MB max size

const authService = require("../services/authService");

const router = express.Router();

router.use(authService.protect);
router.use(authService.allowedTo("user"));

router.get('/get-me', getLoggedUserData, getUser);
router.put("/change-my-password", updateLoggedUserPassword);
router.put(
  "/update-me",
  uploadImage.single('avatar'),
  updateLoggedUserValidator,
  updateLoggedUserData
);
router.delete("/delete-me", deleteLoggedUserData);
router.put("/seen-notification/:id", seenNotification);
router.delete("/delete-notification/:id", deleteNotification);
router.get("/get-all-user-notifications", getAllUserNotifications);
router.get("/get-all-services", getAllServicesForUser);
router.get("/get-all-meetings", getAllMeetingsForUser);
router.get("/get-process/:id", getProcessForService);
router.get("/get-all-services-process", getAllServicesProcess);
router.delete("/delete-all-seen-notifications", deleteAllSeenNotifications);

module.exports = router;
