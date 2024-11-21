const fetch = require('node-fetch');

module.exports.checkIPReputation = async (ip) => {
  try {
    const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`, {
      headers: { Key: process.env.ABUSEIPDB_API_KEY },
    });
    const data = await response.json();
    return data.data.abuseConfidenceScore >= 50;
  } catch (err) {
    console.error('[ERROR] IP Reputation Check:', err);
    return false;
  }
};