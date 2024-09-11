// Helper to handle stripe and other errors
exports.handleStripeError = (error) => {
  // console.error(error);
  if (error.type === 'StripeCardError') {
    return {
      status: 400,
      message: 'Card error occurred',
      details: error.message,
    };
  }
  return {
    status: 500,
    message: 'Internal Server Error',
    details: error.message,
  };
};
