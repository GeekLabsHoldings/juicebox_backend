const express = require("express");
const {
  getAllCallSalesServices,
  getAllUsers,
  updateService,
  getAllServicesForUser,
  notifyUser,
  getAllUserNotifications,
  seenNotification,
  deleteNotification,
  deleteService,
  deleteUser,
  addNewVacancy,
  updateVacancy,
  deleteVacancy,
  getAllCareersForVacancy,
  // getAllUserCredits,
} = require("../controllers/adminController");

const authService = require("../services/authService");

const router = express.Router();

router.use(authService.protect);

router.use(authService.allowedTo("admin"));

router.get("/get-all-call-sales-services", getAllCallSalesServices);
router.delete("/delete-service", deleteService);
router.delete("/delete-user", deleteUser);
router.put("/update-service", updateService);
router.get("/get-all-users", getAllUsers);
router.get("/get-all-user-notifications", getAllUserNotifications);
router.post("/notify-user", notifyUser);
router.delete("/delete-notification", deleteNotification);
router.put("/seen-notification", seenNotification);
router.get("/get-all-services-for-user", getAllServicesForUser);
router.post("/add-new-vacancy", addNewVacancy);
router.put("/update-vacancy", updateVacancy);
router.delete("/delete-vacancy", deleteVacancy);
router.get("/get-all-careers-for-vacancy", getAllCareersForVacancy);
// router.get("/get-all-user-credits", getAllUserCredits);

module.exports = router;
