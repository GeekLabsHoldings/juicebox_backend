const { retrieveBalance } = require('../helpers/retriveBalance');

// Update the user's balance after making a purchase
exports.updateUserBalance = async (user, amount) => {
  if (user.balance < amount) {
    throw new Error('Insufficient balance');
  }
  
  user.balance -= amount;
  await user.save();
};

// Check if the user has sufficient balance for a service
exports.checkBalance = (user, servicePrice) => {
  return user.balance >= servicePrice;
};

// Update the user's balance from Stripe's available balance
exports.updateBalanceInUserModel = async (user) => {
  const { availableBalance, currency } = await retrieveBalance();
  
  // Update the user model with the new balance and currency
  user.balance = availableBalance;
  user.currency = currency;
  await user.save();
};
