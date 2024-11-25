const express = require("express");
const {
  getAllBlogs,
  getBlog,
} = require("../controllers/blogsController");
const { getUploadUrl } = require('../services/uploadPresignedUrl');
const cacheMiddleware = require('../middlewares/cachingMiddleware');

const router = express.Router();

// 86400
router.get("/get-blog/:id", cacheMiddleware((req) => `blog_${req.params.id}`, 120), getBlog);
router.get("/get-all-blogs", cacheMiddleware(() => 'all_blogs', 120), getAllBlogs);

router.post('/generate-upload-url', getUploadUrl);

module.exports = router;
