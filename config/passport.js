const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userModel");
const asyncHandler = require('express-async-handler');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      const user = await User.findOne({ googleId: profile.id });

      if (user) {
        return done(null, user);
      }

      const newUser = new User({
        googleId: profile.id,
        name: profile.name.givenName,
        email: profile.emails[0].value,
        avatar: profile._json.picture,
        verifyEmail: profile._json.email_verified,
      });

      await newUser.save();
      done(null, newUser);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(
  asyncHandler(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
  })
);

/* 
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');

// Helper function to handle async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      const user = await User.findOne({ googleId: profile.id });

      if (user) {
        return done(null, user);
      }

      const newUser = new User({
        googleId: profile.id,
        name: profile.name.givenName,
        email: profile.emails[0].value,
        avatar: profile._json.picture,
        verifyEmail: profile._json.email_verified,
      });

      await newUser.save();
      done(null, newUser);
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(
  asyncHandler(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
  }),
);
*/
