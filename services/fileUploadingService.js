const createMulterStorage = require('../middlewares/multerFileMiddleware');

const uploadMediaWithFile = (fieldNames) => {
  const upload = createMulterStorage(
    'services',
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
    50 * 1024 * 1024, // 50 MB max size for media files
  ).fields(fieldNames);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        return next(err); // Handle multer upload errors
      }
      next();
    });
  };
};

module.exports = uploadMediaWithFile;
