const { retrieveBalance } = require('../helpers/retriveBalance');

exports.updateUserBalance = async (user, amount, session) => {
  // Deduct the amount from the user's balance
  user.balance -= amount;
  await user.save({ session });  // Ensure session is used when saving
};


exports.checkBalance = (user, servicePrice) => {
  return user.balance >= servicePrice;
};

exports.updateBalanceInUserModel = async (user, session) => {
  const { availableBalance, currency } = await retrieveBalance();
  user.balance = availableBalance;
  user.currency = currency;
  await user.save({ session });  // Ensure session is used when saving
};
