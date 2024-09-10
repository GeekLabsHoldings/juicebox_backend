const express = require("express");
const {
  getAllCallSalesServices,
  getAllUsers,
  updateService,
  notifyUser,
  // getAllUserNotifications,
  deleteService,
  deleteUser,
  addNewVacancy,
  updateVacancy,
  deleteVacancy,
  getAllCareersForVacancy,
  makeProcessService,
  updateProcessService,
  createMeeting,
  updateMeeting,
  deleteMeeting,
} = require("../controllers/adminController");

const authService = require("../services/authService");

const router = express.Router();

router.use(authService.protect);

router.use(authService.allowedTo("admin"));

router.get("/get-all-call-sales-services", getAllCallSalesServices);
router.delete("/delete-service/:id", deleteService);
router.delete("/delete-user/:id", deleteUser);
router.put("/update-service/:id", updateService);
router.patch("/update-process-service/:id", updateProcessService);
router.post("/make-process-service", makeProcessService);
router.get("/get-all-users", getAllUsers);
router.post("/notify-user", notifyUser);
router.post("/add-new-vacancy", addNewVacancy);
router.put("/update-vacancy/:id", updateVacancy);
router.post("/create-meeting", createMeeting);
router.put("/update-meeting/:id", updateMeeting);
router.delete("/delete-meeting/:id", deleteMeeting);
router.delete("/delete-vacancy/:id", deleteVacancy);
router.get("/get-all-careers-for-vacancy", getAllCareersForVacancy);

module.exports = router;
