const {
  CheckDomainAvailabilityCommand,
  GetDomainSuggestionsCommand,
  ListPricesCommand,
} = require('@aws-sdk/client-route-53-domains');
const { route53 } = require('../config/awsConfig');

// Utility function to get TLD from domain
function getTLD(domain) {
  const domainParts = domain.split('.');
  return domainParts.pop();
}

// Fetch the price for a given TLD
async function getDomainPrice(tld) {
  try {
    const pricesCommand = new ListPricesCommand({ Tld: tld });
    const pricesResponse = await route53.send(pricesCommand);
    const priceInfo = pricesResponse.Prices[0];

    if (!priceInfo) throw new Error(`No prices found for TLD: ${tld}`);

    return {
      registrationPrice: priceInfo.RegistrationPrice,
      renewalPrice: priceInfo.RenewalPrice,
    };
  } catch (error) {
    console.error(`Error fetching prices for .${tld}:`, error);
    throw new Error(`Could not fetch price for .${tld} domain.`);
  }
}

// Check if the domain exists
async function checkDomainAvailability(domain) {
  try {
    const availabilityCommand = new CheckDomainAvailabilityCommand({
      DomainName: domain,
    });
    const availabilityResponse = await route53.send(availabilityCommand);
    return availabilityResponse.Availability === 'AVAILABLE';
  } catch (error) {
    console.error(`Error checking domain availability for ${domain}:`, error);
    throw error;
  }
}

// Get domain suggestions with prices
async function getDomainSuggestions(domain, maxSuggestions = 10) {
  try {
    const suggestionsCommand = new GetDomainSuggestionsCommand({
      DomainName: domain,
      OnlyAvailable: true,
      SuggestionCount: maxSuggestions,
    });
    const suggestionsResponse = await route53.send(suggestionsCommand);

    // Fetch prices in parallel for suggested domains
    const suggestionsWithPrices = await Promise.allSettled(
      (suggestionsResponse.SuggestionsList || []).map(async (suggestion) => {
        const suggestionTLD = getTLD(suggestion.DomainName);
        const prices = await getDomainPrice(suggestionTLD);
        return { DomainName: suggestion.DomainName, prices };
      })
    );

    return suggestionsWithPrices
      .filter(({ status }) => status === 'fulfilled')
      .map(({ value }) => value);
  } catch (error) {
    console.error('Error fetching domain suggestions:', error);
    throw error;
  }
}

// Main function to check domain availability and return suggestions if unavailable
async function checkDomainExists(domain) {
  const domainTLD = getTLD(domain);

  try {
    // Run price and availability checks in parallel
    const [isAvailable, prices] = await Promise.all([
      checkDomainAvailability(domain),
      getDomainPrice(domainTLD),
    ]);

    if (isAvailable) {
      return {
        available: true,
        prices,
        message: `Domain ${domain} is available`,
      };
    }

    // Fetch suggestions only if domain is unavailable
    const suggestions = await getDomainSuggestions(domain);
    return {
      available: false,
      suggestions,
    };
  } catch (error) {
    console.error('Error checking domain existence:', error);
    throw error;
  }
}

module.exports = checkDomainExists;

// const {
//   CheckDomainAvailabilityCommand,
//   GetDomainSuggestionsCommand,
//   ListPricesCommand,
// } = require('@aws-sdk/client-route-53-domains');
// const { route53 } = require('../config/awsConfig');

// // Utility function to get TLD from domain
// function getTLD(domain) {
//   const domainParts = domain.split('.');
//   return domainParts.pop();
// }

// // Simple cache to store TLD prices without expiration (since prices don’t change often)
// const tldPriceCache = new Map();

// // Fetch the registration price for a given TLD
// async function getDomainRegistrationPrice(tld) {
//   // Check if the price is already cached
//   if (tldPriceCache.has(tld)) {
//     return tldPriceCache.get(tld);
//   }

//   try {
//     const pricesCommand = new ListPricesCommand({ Tld: tld });
//     const pricesResponse = await route53.send(pricesCommand);
//     const priceInfo = pricesResponse.Prices[0];

//     if (!priceInfo) throw new Error(`No prices found for TLD: ${tld}`);

//     const registrationPrice = priceInfo.RegistrationPrice;

//     // Cache the registration price for future use
//     tldPriceCache.set(tld, registrationPrice);
//     return registrationPrice;
//   } catch (error) {
//     console.error(`Error fetching prices for .${tld}:`, error);
//     throw new Error(`Could not fetch price for .${tld} domain.`);
//   }
// }

// // Check if the domain exists
// async function checkDomainAvailability(domain) {
//   try {
//     const availabilityCommand = new CheckDomainAvailabilityCommand({
//       DomainName: domain,
//     });
//     const availabilityResponse = await route53.send(availabilityCommand);
//     return availabilityResponse.Availability === 'AVAILABLE';
//   } catch (error) {
//     console.error(`Error checking domain availability for ${domain}:`, error);
//     throw error;
//   }
// }

// // Get domain suggestions with prices
// async function getDomainSuggestions(domain, maxSuggestions = 20) {
//   try {
//     const suggestionsCommand = new GetDomainSuggestionsCommand({
//       DomainName: domain,
//       OnlyAvailable: true,
//       SuggestionCount: maxSuggestions,
//     });
//     const suggestionsResponse = await route53.send(suggestionsCommand);

//     // Fetch registration prices for suggested domains in parallel
//     const suggestionsWithPrices = await Promise.allSettled(
//       (suggestionsResponse.SuggestionsList || []).map(async (suggestion) => {
//         const suggestionTLD = getTLD(suggestion.DomainName);
//         const registrationPrice = await getDomainRegistrationPrice(suggestionTLD);
//         return { DomainName: suggestion.DomainName, registrationPrice };
//       })
//     );

//     return suggestionsWithPrices
//       .filter(({ status }) => status === 'fulfilled')
//       .map(({ value }) => value);
//   } catch (error) {
//     console.error('Error fetching domain suggestions:', error);
//     throw error;
//   }
// }

// // Main function to check domain availability and return suggestions if unavailable
// async function checkDomainExists(domain, includeSuggestions = true) {
//   const domainTLD = getTLD(domain);

//   try {
//     // Run availability check and price fetch in parallel
//     const [isAvailable, registrationPrice] = await Promise.all([
//       checkDomainAvailability(domain),
//       getDomainRegistrationPrice(domainTLD),
//     ]);

//     if (isAvailable) {
//       return {
//         available: true,
//         registrationPrice,
//         message: `Domain ${domain} is available`,
//       };
//     }

//     // Fetch suggestions only if the domain is unavailable and suggestions are requested
//     let suggestions = [];
//     if (includeSuggestions) {
//       suggestions = await getDomainSuggestions(domain);
//     }

//     return {
//       available: false,
//       registrationPrice,
//       suggestions,
//     };
//   } catch (error) {
//     console.error('Error checking domain existence:', error);
//     throw error;
//   }
// }

// module.exports = checkDomainExists;

// const {
//   CheckDomainAvailabilityCommand,
//   GetDomainSuggestionsCommand,
//   ListPricesCommand,
// } = require('@aws-sdk/client-route-53-domains');
// const { route53 } = require('../config/awsConfig');

// // Utility function to get TLD from domain
// function getTLD(domain) {
//   const domainParts = domain.split('.');
//   return domainParts.pop();
// }

// // Fetch the price for a given TLD
// async function getDomainPrice(tld) {
//   try {
//     const pricesCommand = new ListPricesCommand({ Tld: tld });
//     const pricesResponse = await route53.send(pricesCommand);
//     const priceInfo = pricesResponse.Prices[0];

//     if (!priceInfo) throw new Error(`No prices found for TLD: ${tld}`);

//     return {
//       registrationPrice: priceInfo.RegistrationPrice,
//       renewalPrice: priceInfo.RenewalPrice,
//     };
//   } catch (error) {
//     console.error(`Error fetching prices for .${tld}:`, error);
//     throw new Error(`Could not fetch price for .${tld} domain.`);
//   }
// }

// // Check if the domain exists
// async function checkDomainAvailability(domain) {
//   try {
//     const availabilityCommand = new CheckDomainAvailabilityCommand({
//       DomainName: domain,
//     });
//     const availabilityResponse = await route53.send(availabilityCommand);
//     return availabilityResponse.Availability === 'AVAILABLE';
//   } catch (error) {
//     console.error(`Error checking domain availability for ${domain}:`, error);
//     throw error;
//   }
// }

// // Get domain suggestions with prices
// async function getDomainSuggestions(domain, maxSuggestions = 10) {
//   try {
//     const suggestionsCommand = new GetDomainSuggestionsCommand({
//       DomainName: domain,
//       OnlyAvailable: true,
//       SuggestionCount: maxSuggestions,
//     });
//     const suggestionsResponse = await route53.send(suggestionsCommand);

//     // Fetch prices in parallel for suggested domains
//     const suggestionsWithPrices = await Promise.allSettled(
//       (suggestionsResponse.SuggestionsList || []).map(async (suggestion) => {
//         const suggestionTLD = getTLD(suggestion.DomainName);
//         const prices = await getDomainPrice(suggestionTLD);
//         return { DomainName: suggestion.DomainName, prices };
//       })
//     );

//     return suggestionsWithPrices
//       .filter(({ status }) => status === 'fulfilled')
//       .map(({ value }) => value);
//   } catch (error) {
//     console.error('Error fetching domain suggestions:', error);
//     throw error;
//   }
// }

// // Main function to check domain availability and return suggestions if unavailable
// async function checkDomainExists(domain) {
//   const domainTLD = getTLD(domain);

//   try {
//     // Run price and availability checks in parallel
//     const [isAvailable, prices] = await Promise.all([
//       checkDomainAvailability(domain),
//       getDomainPrice(domainTLD),
//     ]);

//     if (isAvailable) {
//       return {
//         available: true,
//         prices,
//         message: `Domain ${domain} is available`,
//       };
//     }

//     // Fetch suggestions only if domain is unavailable
//     const suggestions = await getDomainSuggestions(domain);
//     return {
//       available: false,
//       suggestions,
//     };
//   } catch (error) {
//     console.error('Error checking domain existence:', error);
//     throw error;
//   }
// }

// module.exports = checkDomainExists;

// const {
//   CheckDomainAvailabilityCommand,
//   GetDomainSuggestionsCommand,
//   ListPricesCommand,
// } = require('@aws-sdk/client-route-53-domains');
// const { route53 } = require('../config/awsConfig');

// // Cache settings
// const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes cache expiration

// // Cache data with expiration
// class ExpiringCache {
//   constructor() {
//     this.cache = new Map();
//   }

//   set(key, value, ttl) {
//     const expiresAt = Date.now() + ttl;
//     this.cache.set(key, { value, expiresAt });

//     // Automatically remove the key after TTL
//     setTimeout(() => this.cache.delete(key), ttl);
//   }

//   get(key) {
//     const cachedEntry = this.cache.get(key);
//     if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
//       return cachedEntry.value;
//     }
//     this.cache.delete(key);
//     return null;
//   }

//   has(key) {
//     return this.get(key) !== null;
//   }
// }

// // Instantiate caches with expiration
// const tldPriceCache = new ExpiringCache();
// const domainAvailabilityCache = new ExpiringCache();

// // Utility function to get TLD from domain
// function getTLD(domain) {
//   const domainParts = domain.split('.');
//   return domainParts.pop();
// }

// // Fetch the price for a given TLD
// async function getDomainPrice(tld) {
//   if (tldPriceCache.has(tld)) {
//     return tldPriceCache.get(tld);
//   }

//   try {
//     const pricesCommand = new ListPricesCommand({ Tld: tld });
//     const pricesResponse = await route53.send(pricesCommand);
//     const priceInfo = pricesResponse.Prices[0];

//     if (!priceInfo) throw new Error(`No prices found for TLD: ${tld}`);

//     const priceData = {
//       registrationPrice: priceInfo.RegistrationPrice,
//       renewalPrice: priceInfo.RenewalPrice,
//     };

//     tldPriceCache.set(tld, priceData, CACHE_TTL_MS);
//     return priceData;
//   } catch (error) {
//     console.error(`Error fetching prices for .${tld}:`, error);
//     throw new Error(`Could not fetch price for .${tld} domain.`);
//   }
// }

// // Check if the domain exists
// async function checkDomainAvailability(domain) {
//   try {
//     const availabilityCommand = new CheckDomainAvailabilityCommand({
//       DomainName: domain,
//     });
//     const availabilityResponse = await route53.send(availabilityCommand);
//     return availabilityResponse.Availability === 'AVAILABLE';
//   } catch (error) {
//     console.error(`Error checking domain availability for ${domain}:`, error);
//     throw error;
//   }
// }

// // Get domain suggestions with prices
// async function getDomainSuggestions(domain) {
//   try {
//     const suggestionsCommand = new GetDomainSuggestionsCommand({
//       DomainName: domain,
//       OnlyAvailable: true,
//       SuggestionCount: 20,
//     });
//     const suggestionsResponse = await route53.send(suggestionsCommand);

//     const suggestionsWithPrices = await Promise.allSettled(
//       (suggestionsResponse.SuggestionsList || []).map(async (suggestion) => {
//         const suggestionTLD = getTLD(suggestion.DomainName);
//         const prices = await getDomainPrice(suggestionTLD);
//         return { DomainName: suggestion.DomainName, prices };
//       })
//     );

//     return suggestionsWithPrices
//       .filter(({ status }) => status === 'fulfilled')
//       .map(({ value }) => value);
//   } catch (error) {
//     console.error('Error fetching domain suggestions:', error);
//     throw error;
//   }
// }

// // Main function to check domain availability and return suggestions if unavailable
// async function checkDomainExists(domain) {
//   const domainTLD = getTLD(domain);

//   if (domainAvailabilityCache.has(domain)) {
//     console.log(`Using cached availability for ${domain}`);
//     return domainAvailabilityCache.get(domain);
//   }

//   try {
//     const isAvailable = await checkDomainAvailability(domain);

//     if (isAvailable) {
//       const prices = await getDomainPrice(domainTLD);
//       const result = {
//         available: true,
//         prices,
//         message: `Domain ${domain} is available`,
//       };

//       domainAvailabilityCache.set(domain, result, CACHE_TTL_MS);
//       return result;
//     }

//     const suggestions = await getDomainSuggestions(domain);

//     const result = {
//       available: false,
//       suggestions,
//     };

//     domainAvailabilityCache.set(domain, result, CACHE_TTL_MS);
//     return result;
//   } catch (error) {
//     console.error('Error checking domain existence:', error);
//     throw error;
//   }
// }

// module.exports = checkDomainExists;

// const {
//   CheckDomainAvailabilityCommand,
//   GetDomainSuggestionsCommand,
//   ListPricesCommand,
// } = require("@aws-sdk/client-route-53-domains");
// const { route53 } = require("../config/awsConfig");

// const supportedTLDs = new Set([
//   "com",
//   "net",
//   "org",
//   "info",
//   "biz",
//   "us",
//   "co",
//   "io",
// ]);

// const tldPriceCache = new Map();
// const domainAvailabilityCache = new Map();

// function getTLD(domain) {
//   const domainParts = domain.split(".");
//   return domainParts.pop();
// }

// function isSupportedTLD(tld) {
//   return supportedTLDs.has(tld);
// }

// async function getDomainPrice(tld) {
//   if (tldPriceCache.has(tld)) {
//     // console.log(`Using cached price for .${tld}`);
//     return tldPriceCache.get(tld);
//   }

//   try {
//     const pricesCommand = new ListPricesCommand({ Tld: tld });
//     const pricesResponse = await route53.send(pricesCommand);
//     const priceInfo = pricesResponse.Prices[0];

//     const priceData = {
//       registrationPrice: priceInfo.RegistrationPrice,
//       renewalPrice: priceInfo.RenewalPrice,
//     };

//     tldPriceCache.set(tld, priceData);
//     // console.log(`Fetched and cached price for .${tld}`);
//     return priceData;
//   } catch (error) {
//     console.error(`Error fetching prices for .${tld}:`, error);
//     throw new Error(`Could not fetch price for .${tld} domain.`);
//   }
// }

// async function checkDomainExists(domain) {
//   const domainTLD = getTLD(domain);

//   if (!isSupportedTLD(domainTLD)) {
//     throw new Error(`The TLD .${domainTLD} is not supported`);
//   }

//   if (domainAvailabilityCache.has(domain)) {
//     console.log(`Using cached availability for ${domain}`);
//     return domainAvailabilityCache.get(domain);
//   }

//   try {
//     const availabilityCommand = new CheckDomainAvailabilityCommand({
//       DomainName: domain,
//     });
//     const availabilityResponse = await route53.send(availabilityCommand);

//     let result;

//     if (availabilityResponse.Availability === "AVAILABLE") {
//       const prices = await getDomainPrice(domainTLD);
//       result = {
//         available: true,
//         prices,
//         message: `Domain ${domain} is available`,
//       };
//     } else {
//       const suggestionsCommand = new GetDomainSuggestionsCommand({
//         DomainName: domain,
//         OnlyAvailable: true,
//         SuggestionCount: 20,
//       });
//       const suggestionsResponse = await route53.send(suggestionsCommand);

//       const suggestionsWithPrices = await Promise.allSettled(
//         (suggestionsResponse.SuggestionsList || []).map(async (suggestion) => {
//           const suggestionTLD = getTLD(suggestion.DomainName);
//           if (isSupportedTLD(suggestionTLD)) {
//             const prices = await getDomainPrice(suggestionTLD);
//             return { DomainName: suggestion.DomainName, prices };
//           }
//         })
//       );

//       result = {
//         available: false,
//         suggestions: suggestionsWithPrices
//           .filter(({ status }) => status === "fulfilled")
//           .map(({ value }) => value),
//       };
//     }

//     domainAvailabilityCache.set(domain, result);
//     return result;
//   } catch (error) {
//     console.error("Error checking domain availability:", error);
//     throw error;
//   }
// }

// module.exports = checkDomainExists;
