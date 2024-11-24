 // Helper function to capitalize the first letter of a string
 const capitalizeFirstLetter = (str) => {
  if (typeof str !== 'string' || str.length === 0) return '';

  try {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  } catch (error) {
    console.error('Error capitalizing first letter:', error);
    return '';
  }
};

module.exports = capitalizeFirstLetter;

//  // Helper function to capitalize the first letter of a string
//  const capitalizeFirstLetter = (string) => {
//   if (!string) return "";
//   return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
// };

// module.exports = capitalizeFirstLetter;
