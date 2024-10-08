const express = require("express");
const {
  getAllBlogs,
  getBlog,
} = require("../controllers/blogsController");

const router = express.Router();

router.get("/get-blog/:id", getBlog);
router.get("/get-all-blogs", getAllBlogs);

module.exports = router;
