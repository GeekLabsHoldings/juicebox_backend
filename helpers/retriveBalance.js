const stripe = require("../config/stripe");

const retrieveBalance = async () => {
  try {
    const balance = await stripe.balance.retrieve();

    console.log("Balance retrieved:", balance);

    const availableBalance = balance.available[0].amount;
    const currency = balance.available[0].currency;

    console.log(`Available balance: ${availableBalance} ${currency}`);

    return { availableBalance, currency };
  } catch (error) {
    console.error("Error retrieving balance:", error);
    throw new Error("Failed to retrieve balance");
  }
};

module.exports = { retrieveBalance };
