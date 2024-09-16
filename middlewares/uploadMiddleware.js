const createMulterStorage = require('./multerFileMiddleware');

// Define your storage and allowed file types
const allowedTypes =  [
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/mpeg',
  '.jpg',
  '.jpeg',
  '.png',
  '.mp4',
  '.mpeg',
];
const maxSize = 50 * 1024 * 1024;
const folder = 'services';

const upload = createMulterStorage(folder, allowedTypes, maxSize);

// Export the `any` method to accept all fields
module.exports = upload.any();
