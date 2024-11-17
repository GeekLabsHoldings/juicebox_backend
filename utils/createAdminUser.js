const path = require('path');
const fs = require('fs');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const User = require('../models/userModel');
const { s3 } = require('../config/awsConfig');

const createAdminUser = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      console.log('Admin user already exists.');
      return;
    }

    const adminUser = new User({
      firstName: 'New',
      lastName: 'Admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      adminPosition: 'Sales',
      role: 'admin',
      verifyEmail: true,
    });

    const avatarFilePath = path.join(__dirname, '../uploads', 'default-avatar.jpg');

    // Upload default avatar to S3
    const uploadResult = await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `avatars/${Date.now().toString()}_admin_avatar.jpg`,
        Body: fs.createReadStream(avatarFilePath),
        ContentType: 'image/jpeg',
        ACL: 'public-read',
      })
    );

    adminUser.avatar = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/avatars/${Date.now().toString()}_admin_avatar.jpg`;
    adminUser.s3Key = `avatars/${Date.now().toString()}_admin_avatar.jpg`;

    await adminUser.save();
    console.log('Admin user created successfully with avatar.');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

module.exports = createAdminUser;
