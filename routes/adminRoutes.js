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
  vacancyValidationRules,
} = require('../utils/validators/careerValidator');
const { blogValidationRules } = require('../utils/validators/blogValidator');
const { handleMedia, deleteMedia } = require('../helpers/mediaHandler');
const uploadMediaWithFile = require('../services/fileUploadingService');

const authService = require('../services/authService');

const router = express.Router();

router.use(authService.protect);

router.use(authService.allowedTo('admin'));

router.get('/get-all-call-sales-services', getAllCallSalesServices);
router.delete('/delete-service/:id', deleteService);
router.delete('/delete-user/:id', deleteUser);
router.put('/update-service/:id', updateService);
router.patch('/update-process-service/:id', updateProcessService);
router.post('/make-process-service', makeProcessService);
router.get('/get-all-users', getAllUsers);
router.post('/notify-user', notifyUser);
router.post('/add-new-vacancy', vacancyValidationRules, addNewVacancy);
router.put('/update-vacancy/:id', updateVacancy);
router.post('/create-meeting', createMeetingValidation, createMeeting);
router.put('/update-meeting/:id', updateMeetingValidation, updateMeeting);
router.delete('/delete-meeting/:id', deleteMeeting);
router.delete('/delete-vacancy/:id', deleteVacancy);
router.get('/get-all-careers-for-vacancy', getAllCareersForVacancy);
router.post(
  '/create-blog',
  handleMedia(
    'blogs',
    'mediaUrl',
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
    'mediaUrl',
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
router.delete('/delete-blog/:id', deleteMedia('blogs', 'mediaUrl'), deleteBlog);
router.delete('/delete-all-rejected-careers', deleteAllRejectedCareers);

module.exports = router;
