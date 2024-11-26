const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'A blog must have a title'],
    trim: true,
    // minlength: [2, 'Title must be at least 2 characters long'],
    // maxlength: [100, 'Title must be less than 50 characters long'],
    index: true,
  },
  content: {
    type: String,
    required: [true, 'A blog must have content'],
    trim: true,
    // minlength: [2, 'Content must be at least 2 characters long'],
    // maxlength: [10000, 'Content must be less than 10000 characters long'],
    index: true,
  },
  mediaUrl: {
    type: String,
    default: null, // The S3 location of the main blog image
  },
  s3Key: {
    type: String,
    default: null, // The S3 key of the main blog image (for deletion)
  },
  mediaUrls: {
    type: [String],
    default: [], // Array of multiple media URLs if multiple images are uploaded
  },
  s3AllKeys: {
    type: [String],
    default: [], // Array of S3 keys for the multiple media files (for deletion)
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
