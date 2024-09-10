// Helper to handle stripe and other errors
function handleError(error, res, defaultMessage) {
  console.error(error);
  if (error.type === "StripeCardError") {
    return res.status(400).json({ message: defaultMessage, error: error.message });
  }
  return res.status(500).json({ message: "Internal Server Error", error: error.message });
}

module.exports = handleError;
