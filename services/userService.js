exports.getUsersByRole = (role) => {
  return async (req, res, next) => {
    try {
      req.query.role = role;
      next();
    } catch (err) {
      next(err);
    }
  };
};
