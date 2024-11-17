const express = require('express');
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
  updateProcessServiceOption,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  createBlog,
  updateBlog,
  deleteBlog,
  deleteAllRejectedCareers,
} = require('../controllers/adminController');
const {
  createMeetingValidation,
  updateMeetingValidation,
} = require('../utils/validators/meetingValidator');
const {
  createProcessValidation,
  updateProcessValidation,
  deleteServiceValidation,
  deleteUserValidation,
} = require('../utils/validators/adminValidator');
const {
  vacancyValidationRules,
  updateVacancyValidationRules,
} = require('../utils/validators/careerValidator');
const { blogValidationRules } = require('../utils/validators/blogValidator');
const { handleMedia, deleteMedia } = require('../helpers/mediaHandler');
const {
  trackSuspiciousActivity,
} = require('../middlewares/botProtectionMiddleware');

const authService = require('../services/authService');

const router = express.Router();

router.use(authService.protect);
router.use(trackSuspiciousActivity);
router.use(authService.allowedTo('admin'));

router.get('/get-all-call-sales-services', getAllCallSalesServices);
router.delete('/delete-service/:id', deleteServiceValidation, deleteService);
router.delete('/delete-user/:id', deleteUserValidation, deleteUser);
router.put('/update-service/:id', updateService);
router.patch('/update-process-service-option/:id', updateProcessServiceOption);
router.post('/make-process-service', createProcessValidation, makeProcessService);
router.put('/update-process-service/:id', updateProcessValidation, updateProcessService);
router.get('/get-all-users', getAllUsers);
router.post('/notify-user', notifyUser);
router.post('/add-new-vacancy', vacancyValidationRules, addNewVacancy);
router.put('/update-vacancy/:id', updateVacancyValidationRules, updateVacancy);
router.post('/create-meeting', createMeetingValidation, createMeeting);
router.put('/update-meeting/:id', updateMeetingValidation, updateMeeting);
router.delete('/delete-meeting/:id', deleteMeeting);
router.delete('/delete-vacancy/:id', deleteVacancy);
router.get('/get-all-careers-for-vacancy', getAllCareersForVacancy);

router.post(
  '/create-blog',
  handleMedia(
    'blogs',
    [
      'image/jpeg',
      'image/png',
      'video/mp4',
      'video/mpeg',
      '.jpg',
      '.jpeg',
      '.png',
      '.mp4',
      '.mpeg',
    ],
    50 * 1024 * 1024,
  ),
  blogValidationRules,
  createBlog,
);

router.put(
  '/update-blog/:id',
  handleMedia(
    'blogs',
    [
      'image/jpeg',
      'image/png',
      'video/mp4',
      'video/mpeg',
      '.jpg',
      '.jpeg',
      '.png',
      '.mp4',
      '.mpeg',
    ],
    50 * 1024 * 1024,
  ),
  updateBlog,
);

router.delete('/delete-blog/:id', deleteMedia(), deleteBlog);
router.delete('/delete-all-rejected-careers', deleteAllRejectedCareers);

module.exports = router;
