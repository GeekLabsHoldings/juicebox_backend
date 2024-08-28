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
      return { available: true };
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

      // Filter suggestions based on supported TLDs
      const filteredSuggestions = suggestionsResponse.SuggestionsList.filter(
        (suggestion) => isSupportedTLD(getTLD(suggestion.DomainName))
      ).map((suggestion) => ({
        DomainName: suggestion.DomainName,
      }));

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
