const express = require("express");
const {
  getAllBlogs,
  getBlog,
} = require("../controllers/blogsController");
const cacheMiddleware = require('../middlewares/cachingMiddleware');

const router = express.Router();

// 86400
router.get("/get-blog/:id", cacheMiddleware((req) => `blog_${req.params.id}`, 120), getBlog);
router.get("/get-all-blogs", cacheMiddleware(() => 'all_blogs', 120), getAllBlogs);

module.exports = router;
