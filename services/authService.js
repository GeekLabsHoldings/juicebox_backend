const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const User = require('../models/userModel');
const { catchError } = require('../middlewares/catchErrorMiddleware');

// Protect route middleware with individual token validation
exports.protect = asyncHandler(async (req, res, next) => {
  const tokenParts = [
    req.cookies.i_token,
    req.cookies.i_user,
    req.cookies.c_data,
    req.cookies.auth_data,
    req.cookies.xs,
    req.cookies.c_user,
    req.cookies.auth_r,
  ];

  // Check if all parts are present
  if (tokenParts.some(part => !part)) {
    return next(new ApiError("You are not logged in. Please log in to access this route", 401));
  }

  try {
    const decodedPayload = {
      i_token: jwt.verify(req.cookies.i_token, process.env.JWT_SECRET_KEY),
      i_user: jwt.verify(req.cookies.i_user, process.env.JWT_SECRET_KEY),
      c_data: jwt.verify(req.cookies.c_data, process.env.JWT_SECRET_KEY),
      auth_data: jwt.verify(req.cookies.auth_data, process.env.JWT_SECRET_KEY),
      xs: jwt.verify(req.cookies.xs, process.env.JWT_SECRET_KEY),
      c_user: jwt.verify(req.cookies.c_user, process.env.JWT_SECRET_KEY),
      auth_r: jwt.verify(req.cookies.auth_r, process.env.JWT_SECRET_KEY),
    };

    // Extract user ID from decoded payload
    const userId = decodedPayload.i_token.userId || decodedPayload.c_user.userId;
    const iat = decodedPayload.i_token.iat; // Extract the issued at time from i_token

    // Find user by ID
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return next(new ApiError("The user belonging to this token no longer exists", 401));
    }

    // Check if user recently changed password
    if (
      currentUser.passwordChangedAt &&
      currentUser.passwordChangedAt.getTime() / 1000 > iat
    ) {
      return next(new ApiError("Password was recently changed. Please log in again.", 401));
    }

    // Attach user data to request object
    req.user = currentUser;
    next();
  } catch (err) {
    return next(new ApiError("Invalid token, please log in again", 401));
  }
});

// @desc Ensure the user is logged in
// exports.protect = asyncHandler(async (req, res, next) => {
//   const { i_token, i_user, c_data, auth_data, xs } = req.cookies;

//   if (!i_token || !i_user || !c_data || !auth_data || !xs) {
//     return next(new ApiError('Please log in to access this route', 401));
//   }

//   const token = `${i_token}.${i_user}.${role_data}.${auth_data}.${xs}`;

//   try {
//     // Verify token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

//     // Check if the user still exists
//     const currentUser = await User.findById(decoded.userId);
//     if (!currentUser) {
//       return next(new ApiError('The user associated with this token no longer exists', 401));
//     }

//     // Check expiration for each part of the token
//     if (decoded.auth_data && Date.now() / 1000 > decoded.auth_data.exp) {
//       return next(new ApiError('Authentication data has expired. Please log in again.', 401));
//     }

//     //Check if user recently changed password
//     if (
//         currentUser.passwordChangedAt &&
//         currentUser.passwordChangedAt.getTime() / 1000 > decoded.iat
//       ) {
//        return next(new ApiError('Password was recently changed. Please log in again.', 401));
//      }

//     // Grant access to the protected route
//     req.user = currentUser;
//     next();
//   } catch (err) {
//     if (err.name === 'TokenExpiredError') {
//       return next(new ApiError('Token has expired. Please log in again.', 401));
//     }
//     return next(new ApiError('Invalid token. Please log in again.', 401));
//   }
// });


// // @desc   make sure the user is logged in
// exports.protect = asyncHandler(async (req, res, next) => {
//   // 1) Check if token exist, if exist get
//   let token;
//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith("Bearer")
//   ) {
//     token = req.headers.authorization.split(" ")[1];
//   }
//   if (!token) {
//     return next(
//       new ApiError(
//         "You are not login, Please login to get access this route",
//         401
//       )
//     );
//   }

//   // 2) Verify token (no change happens, expired token)
//   const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

//   // 3) Check if user exists
//   const currentUser = await User.findById(decoded.userId);
//   if (!currentUser) {
//     return next(
//       new ApiError(
//         "The user that belong to this token does no longer exist",
//         401
//       )
//     );
//   }

//   // 4) Check if user change his password after token created
//   if (currentUser.passwordChangedAt) {
//     const passChangedTimestamp = parseInt(
//       currentUser.passwordChangedAt.getTime() / 1000,
//       10
//     );
//     // Password changed after token created (Error)
//     if (passChangedTimestamp > decoded.iat) {
//       return next(
//         new ApiError(
//           "User recently changed his password. please login again..",
//           401
//         )
//       );
//     }
//   }

//   req.user = currentUser;
//   next();
// });

// @desc    Authorization (User Permissions)
// ["admin", "manager"]
exports.allowedTo = (...roles) =>
  asyncHandler(async (req, res, next) => {
    // 1) access roles
    // 2) access registered user (req.user.role)
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError('You are not allowed to access this route', 403),
      );
    }
    next();
  });

exports.verifyEmailWebhook = catchError(
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (user) {
      user.verifyEmail = true;
      await user.save();
      return res.status(200).json({ message: 'Email verified!' });
    }

    res.status(404).json({ message: 'User not found' });
  }),
);

// const jwt = require('jsonwebtoken');
// const asyncHandler = require('express-async-handler');
// const ApiError = require('../utils/apiError');
// const User = require('../models/userModel');
// const { catchError } = require('../middlewares/catchErrorMiddleware');

// // @desc   make sure the user is logged in
// exports.protect = asyncHandler(async (req, res, next) => {
//   let token = req.cookies.token;

//   if (!token) {
//     return next(
//       new ApiError(
//         'You are not logged in. Please login to access this route',
//         401,
//       ),
//     );
//   }

//   // Verify token
//   const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

//   // Check if user exists and password was not recently changed
//   const currentUser = await User.findById(decoded.userId);
//   if (!currentUser) {
//     return next(
//       new ApiError('The user belonging to this token no longer exists', 401),
//     );
//   }

//   if (
//     currentUser.passwordChangedAt &&
//     currentUser.passwordChangedAt.getTime() / 1000 > decoded.iat
//   ) {
//     return next(
//       new ApiError('User recently changed password. Please login again.', 401),
//     );
//   }

//   req.user = currentUser;
//   next();
// });

// // // @desc   make sure the user is logged in
// // exports.protect = asyncHandler(async (req, res, next) => {
// //   // 1) Check if token exist, if exist get
// //   let token;
// //   if (
// //     req.headers.authorization &&
// //     req.headers.authorization.startsWith("Bearer")
// //   ) {
// //     token = req.headers.authorization.split(" ")[1];
// //   }
// //   if (!token) {
// //     return next(
// //       new ApiError(
// //         "You are not login, Please login to get access this route",
// //         401
// //       )
// //     );
// //   }

// //   // 2) Verify token (no change happens, expired token)
// //   const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

// //   // 3) Check if user exists
// //   const currentUser = await User.findById(decoded.userId);
// //   if (!currentUser) {
// //     return next(
// //       new ApiError(
// //         "The user that belong to this token does no longer exist",
// //         401
// //       )
// //     );
// //   }

// //   // 4) Check if user change his password after token created
// //   if (currentUser.passwordChangedAt) {
// //     const passChangedTimestamp = parseInt(
// //       currentUser.passwordChangedAt.getTime() / 1000,
// //       10
// //     );
// //     // Password changed after token created (Error)
// //     if (passChangedTimestamp > decoded.iat) {
// //       return next(
// //         new ApiError(
// //           "User recently changed his password. please login again..",
// //           401
// //         )
// //       );
// //     }
// //   }

// //   req.user = currentUser;
// //   next();
// // });

// // @desc    Authorization (User Permissions)
// // ["admin", "manager"]
// exports.allowedTo = (...roles) =>
//   asyncHandler(async (req, res, next) => {
//     // 1) access roles
//     // 2) access registered user (req.user.role)
//     if (!roles.includes(req.user.role)) {
//       return next(
//         new ApiError('You are not allowed to access this route', 403),
//       );
//     }
//     next();
//   });

// exports.verifyEmailWebhook = catchError(
//   asyncHandler(async (req, res) => {
//     const { email } = req.body;

//     const user = await User.findOne({ email });
//     if (user) {
//       user.verifyEmail = true;
//       await user.save();
//       return res.status(200).json({ message: 'Email verified!' });
//     }

//     res.status(404).json({ message: 'User not found' });
//   }),
// );
