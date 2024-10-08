// @desc    this class is responsible about operation errors (errors that i can predict)
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.statusCode = status;
    this.status = `${status}`.startsWith(4) ? 'fail' : 'error';
    this.isOperational = true;
    this.success = false;
  }
}

module.exports = ApiError;
