const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const AppleStrategy = require("passport-apple");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../utils/sendEmail");
const { verifyEmailTemplate } = require("../template/verifyEmail");

// Configure Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/v1/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          if (!user.verifyEmail) {
            // Email not verified, resend verification email
            const token = jwt.sign(
              { email: user.email },
              process.env.JWT_SECRET_KEY,
              { expiresIn: process.env.JWT_EXPIRE_TIME }
            );
            await sendEmail(
              user.email,
              "Please Verify Your Email",
              verifyEmailTemplate(token)
            );
            return done(null, false, { message: "Please verify your email" });
          }
          // User found and email verified
          return done(null, user);
        }

        // Create a new user if not found
        const newUser = new User({
          googleId: profile.id,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          email: profile.emails[0].value,
          password: "MyPassword$1", // Consider removing this if not needed
          avatar: profile._json.picture,
        });

        await newUser.save();
        // Send verification email
        const token = jwt.sign(
          { email: newUser.email },
          process.env.JWT_SECRET_KEY,
          { expiresIn: process.env.JWT_EXPIRE_TIME }
        );
        await sendEmail(
          newUser.email,
          "Please Verify Your Email",
          verifyEmailTemplate(token)
        );

        done(null, newUser);
      } catch (err) {
        done(err);
      }
    }
  )
);

// Configure Apple Strategy
passport.use(
  new AppleStrategy(
    {
      clientID: process.env.APPLE_CLIENT_ID,
      teamID: process.env.APPLE_TEAM_ID,
      callbackURL: "/api/v1/auth/apple/callback",
      keyID: process.env.APPLE_KEY_ID,
      privateKeyLocation: process.env.APPLE_PRIVATE_KEY,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, idToken, profile, done) => {
      try {
        let user = await User.findOne({ appleId: profile.id });
        if (user) {
          if (!user.verifyEmail) {
            // Email not verified, resend verification email
            const token = jwt.sign(
              { email: user.email },
              process.env.JWT_SECRET_KEY,
              { expiresIn: process.env.JWT_EXPIRE_TIME }
            );
            await sendEmail(
              user.email,
              "Please Verify Your Email",
              verifyEmailTemplate(token)
            );
            return done(null, false, { message: "Please verify your email" });
          }
          // User found and email verified
          return done(null, user);
        }

        // Create a new user if not found
        const newUser = new User({
          appleId: profile.id,
          firstName: profile.name.firstName,
          lastName: profile.name.lastName,
          email: profile.email,
          password: "MyPassword$1",
          avatar: profile._json.picture,
        });

        await newUser.save();
        // Send verification email
        const token = jwt.sign(
          { email: newUser.email },
          process.env.JWT_SECRET_KEY,
          { expiresIn: process.env.JWT_EXPIRE_TIME }
        );
        await sendEmail(
          newUser.email,
          "Please Verify Your Email",
          verifyEmailTemplate(token)
        );

        done(null, newUser);
      } catch (err) {
        done(err);
      }
    }
  )
);

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});
