// helpers/retrieveBalance.js
const stripe = require("../config/stripe");

const retrieveBalance = async () => {
  try {
    const balance = await stripe.balance.retrieve();
    console.log("Balance retrieved:", balance);

    const availableBalance = balance.available[0]?.amount || 0;
    const currency = balance.available[0]?.currency || 'usd';

    console.log(`Available balance: ${availableBalance} ${currency}`);
    return { availableBalance, currency };
  } catch (error) {
    console.error("Error retrieving balance:", error);
    throw new Error("Failed to retrieve balance");
  }
};

module.exports = { retrieveBalance };
