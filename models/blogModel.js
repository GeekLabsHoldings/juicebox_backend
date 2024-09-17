const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 3,
      maxlength: 100,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 500,
      index: true,
    },

    mediaUrl: {
      type: String,
    },
    s3Key: {
      type: String,
    },
    spot: {
      type: String,
    },
    status: {
      type: String,
      enum: ['published', 'draft'],
      default: 'published',
    },
  },
  {
    timestamps: true,
  },
);

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;
