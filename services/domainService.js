const {
  CheckDomainAvailabilityCommand,
  GetDomainSuggestionsCommand,
  ListPricesCommand,
} = require('@aws-sdk/client-route-53-domains');
const { route53 } = require('../config/awsConfig');

// Limit concurrent requests to prevent throttling
const CONCURRENCY_LIMIT = 5;
let limit;
(async () => {
  const pLimit = (await import('p-limit')).default;
  limit = pLimit(CONCURRENCY_LIMIT);
})();


// Utility function to get TLD from domain
function getTLD(domain) {
  const domainParts = domain.split('.');
  return domainParts.pop();
}

// Fetch the price for multiple TLDs concurrently
async function getPricesForTLDs(tlds) {
  const pricePromises = tlds.map((tld) =>
    limit(async () => {
      try {
        const pricesCommand = new ListPricesCommand({ Tld: tld });
        const pricesResponse = await route53.send(pricesCommand);
        const priceInfo = pricesResponse.Prices?.[0];
        if (!priceInfo) throw new Error(`No prices found for TLD: ${tld}`);
        return {
          tld,
          registrationPrice: priceInfo.RegistrationPrice,
          renewalPrice: priceInfo.RenewalPrice,
        };
      } catch (error) {
        console.warn(`Error fetching prices for .${tld}:`, error.message);
        return null; // Graceful fallback
      }
    }),
  );

  const results = await Promise.all(pricePromises);
  return results.filter(Boolean); // Remove null entries
}

// Check domain availability
async function checkDomainAvailability(domain) {
  try {
    const availabilityCommand = new CheckDomainAvailabilityCommand({
      DomainName: domain,
    });
    const availabilityResponse = await route53.send(availabilityCommand);
    return availabilityResponse.Availability === 'AVAILABLE';
  } catch (error) {
    console.error(`Error checking availability for ${domain}:`, error.message);
    throw error;
  }
}

// Fetch domain suggestions with prices
async function getDomainSuggestionsWithPrices(domain, maxSuggestions = 20) {
  try {
    const suggestionsCommand = new GetDomainSuggestionsCommand({
      DomainName: domain,
      OnlyAvailable: true,
      SuggestionCount: maxSuggestions,
    });
    const suggestionsResponse = await route53.send(suggestionsCommand);
    const suggestionsList = suggestionsResponse.SuggestionsList || [];
    const tlds = [...new Set(suggestionsList.map((s) => getTLD(s.DomainName)))];

    // Fetch prices for all unique TLDs
    const tldPrices = await getPricesForTLDs(tlds);
    const priceMap = Object.fromEntries(
      tldPrices.map((p) => [
        p.tld,
        {
          registrationPrice: p.registrationPrice,
          renewalPrice: p.renewalPrice,
        },
      ]),
    );

    // Map suggestions to include prices
    return suggestionsList
      .map((suggestion) => {
        const tld = getTLD(suggestion.DomainName);
        const prices = priceMap[tld];
        return prices ? { DomainName: suggestion.DomainName, prices } : null;
      })
      .filter(Boolean); // Filter out suggestions without prices
  } catch (error) {
    console.error('Error fetching domain suggestions:', error.message);
    throw error;
  }
}

// Main function to check domain availability and get suggestions if unavailable
async function checkDomainExists(domain) {
  const domainTLD = getTLD(domain);

  try {
    // Run availability and TLD price checks in parallel
    const [isAvailable, prices] = await Promise.all([
      checkDomainAvailability(domain),
      getPricesForTLDs([domainTLD]).then((results) => results[0] || null),
    ]);

    if (isAvailable) {
      return {
        available: true,
        prices,
        message: `Domain ${domain} is available`,
      };
    }

    // Fetch domain suggestions only if the domain is unavailable
    const suggestions = await getDomainSuggestionsWithPrices(domain);
    return {
      available: false,
      suggestions,
      message: `Domain ${domain} is not available`,
    };
  } catch (error) {
    console.error('Error in checkDomainExists:', error.message);
    throw error;
  }
}

module.exports = checkDomainExists;
