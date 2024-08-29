const {
  Route53DomainsClient,
  CheckDomainAvailabilityCommand,
  GetDomainSuggestionsCommand,
  ListPricesCommand, // send extention of domain
} = require("@aws-sdk/client-route-53-domains");

const client = new Route53DomainsClient({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
  region: process.env.REGION,
});

const supportedTLDs = ["com", "net", "org", "info", "biz", "us", "co", "io"];

function getTLD(domain) {
  const domainParts = domain.split(".");
  return domainParts[domainParts.length - 1];
}

function isSupportedTLD(tld) {
  return supportedTLDs.includes(tld);
}

async function getDomainPrice(tld) {
  try {
    const pricesCommand = new ListPricesCommand({ Tld: tld });
    const pricesResponse = await client.send(pricesCommand);
    const priceInfo = pricesResponse.Prices[0];
    return {
      registrationPrice: priceInfo.RegistrationPrice,
      renewalPrice: priceInfo.RenewalPrice,
    };
  } catch (error) {
    console.error(`Error fetching prices for .${tld}:`, error);
    throw new Error(`Could not fetch price for .${tld} domain.`);
  }
}

async function checkDomainExists(domain) {
  const domainTLD = getTLD(domain);

  if (!isSupportedTLD(domainTLD)) {
    throw new Error(`The TLD .${domainTLD} is not supported`);
  }

  try {
    const availabilityCommand = new CheckDomainAvailabilityCommand({
      DomainName: domain,
    });
    const availabilityResponse = await client.send(availabilityCommand);

    if (availabilityResponse.Availability === "AVAILABLE") {
      // Fetch the price for the available domain
      const prices = await getDomainPrice(domainTLD);
      return {
        available: true,
        prices,
        message: `Domain ${domain} is available`,
      };
    } else {
      // If not available, get domain suggestions
      const suggestionsCommand = new GetDomainSuggestionsCommand({
        DomainName: domain,
        OnlyAvailable: true,
        SuggestionCount: 20,
      });
      const suggestionsResponse = await client.send(suggestionsCommand);

      if (!suggestionsResponse || !suggestionsResponse.SuggestionsList) {
        console.warn("No suggestions received from AWS Route 53.");
        return {
          available: false,
          suggestions: [],
        };
      }

      // Fetch prices for suggested domains
      const suggestionsWithPrices = await Promise.all(
        suggestionsResponse.SuggestionsList.map(async (suggestion) => {
          const suggestionTLD = getTLD(suggestion.DomainName);
          if (isSupportedTLD(suggestionTLD)) {
            const prices = await getDomainPrice(suggestionTLD);
            return {
              DomainName: suggestion.DomainName,
              prices,
            };
          }
        })
      );

      // Filter out any undefined values (if any TLD wasn't supported)
      const filteredSuggestions = suggestionsWithPrices.filter(Boolean);

      return {
        available: false,
        suggestions: filteredSuggestions,
      };
    }
  } catch (error) {
    console.error("Error checking domain availability:", error);
    throw error;
  }
}

module.exports = checkDomainExists;
