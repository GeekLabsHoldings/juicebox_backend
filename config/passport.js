const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const AppleStrategy = require("passport-appleid").Strategy;
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");

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
          // Generate JWT token
          const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
            expiresIn: process.env.JWT_EXPIRE_TIME,
          });
          return done(null, { user, token });
        }

        // If user does not exist, create a new one
        const newUser = new User({
          googleId: profile.id,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          email: profile.emails[0].value,
          password: "MyPassword$1",
          avatar: profile._json.picture,
        });

        await newUser.save();
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET_KEY, {
          expiresIn: process.env.JWT_EXPIRE_TIME,
        });

        return done(null, { user: newUser, token });
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Configure Apple Strategy
passport.use(
  new AppleStrategy(
    {
      clientID: process.env.APPLE_CLIENT_ID,
      callbackURL: "/api/v1/auth/apple/callback",
      teamID: process.env.APPLE_TEAM_ID,
      keyIdentifier: process.env.APPLE_KEY_ID,
      privateKeyString: process.env.APPLE_PRIVATE_KEY,
    },
    async (accessToken, refreshToken, id_token, profile, done) => {
      try {
        let user = await User.findOne({ appleId: profile.id });
        if (user) {
          // Generate JWT token
          const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
            expiresIn: process.env.JWT_EXPIRE_TIME,
          });
          return done(null, { user, token });
        }

        // If user does not exist, create a new one
        const newUser = new User({
          appleId: profile.id,
          firstName: profile.name.firstName,
          lastName: profile.name.lastName,
          email: profile.email,
          password: "MyPassword$1",
          avatar: profile._json.picture,
        });

        await newUser.save();
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET_KEY, {
          expiresIn: process.env.JWT_EXPIRE_TIME,
        });

        return done(null, { user: newUser, token });
      } catch (err) {
        return done(err, null);
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
    done(err, null);
  }
});
