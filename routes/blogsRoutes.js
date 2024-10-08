const express = require("express");
const {
  getAllBlogs,
  getBlog,
} = require("../controllers/blogsController");
const cacheMiddleware = require('../middlewares/cachingMiddleware');

const router = express.Router();

router.get("/get-blog/:id", cacheMiddleware((req) => `blog_${req.params.id}`, 300), getBlog);
router.get("/get-all-blogs", cacheMiddleware(() => 'all_blogs', 300), getAllBlogs);

module.exports = router;
