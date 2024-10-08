const Blog = require('../models/blogModel');
const factory = require('../utils/handlersFactory');

// @desc    Get specific blog by id
// @route   GET /api/v1/blogs/:id
// @access  Public
exports.getBlog = factory.getOne(Blog);

// @desc    Get all blogs
// @route   GET /api/v1/blogs
// @access  Public
exports.getAllBlogs = factory.getAll(Blog, ['title', 'content']);
