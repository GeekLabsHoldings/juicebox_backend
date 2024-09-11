const { retrieveBalance } = require('../helpers/retriveBalance');

exports.updateUserBalance = async (user, amount) => {
  // Deduct the amount from the user's balance
  user.balance -= amount;
  await user.save();
};

exports.checkBalance = (user, servicePrice) => {
  return user.balance >= servicePrice;
};

exports.updateBalanceInUserModel = async (user) => {
  const { availableBalance, currency } = await retrieveBalance();
  user.balance = availableBalance;
  user.currency = currency;
  await user.save();
};
