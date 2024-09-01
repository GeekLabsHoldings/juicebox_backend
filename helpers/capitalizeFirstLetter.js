 // Helper function to capitalize the first letter of a string
 const capitalizeFirstLetter = (string) => {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

module.exports = capitalizeFirstLetter;
