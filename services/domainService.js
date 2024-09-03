const {
  Route53DomainsClient,
  CheckDomainAvailabilityCommand,
  GetDomainSuggestionsCommand,
  ListPricesCommand,
} = require("@aws-sdk/client-route-53-domains");

const client = new Route53DomainsClient({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
  region: process.env.REGION,
});

const supportedTLDs = new Set([
  "com",
  "net",
  "org",
  "info",
  "biz",
  "us",
  "co",
  "io",
]);
const tldPriceCache = new Map(); // Use Map for better lookup performance
const domainAvailabilityCache = new Map(); // Cache domain availability to reduce API calls

function getTLD(domain) {
  const domainParts = domain.split(".");
  return domainParts.pop();
}

function isSupportedTLD(tld) {
  return supportedTLDs.has(tld);
}

async function getDomainPrice(tld) {
  if (tldPriceCache.has(tld)) {
    console.log(`Using cached price for .${tld}`);
    return tldPriceCache.get(tld);
  }

  try {
    const pricesCommand = new ListPricesCommand({ Tld: tld });
    const pricesResponse = await client.send(pricesCommand);
    const priceInfo = pricesResponse.Prices[0];

    const priceData = {
      registrationPrice: priceInfo.RegistrationPrice,
      renewalPrice: priceInfo.RenewalPrice,
    };

    tldPriceCache.set(tld, priceData);
    console.log(`Fetched and cached price for .${tld}`);
    return priceData;
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

  if (domainAvailabilityCache.has(domain)) {
    console.log(`Using cached availability for ${domain}`);
    return domainAvailabilityCache.get(domain);
  }

  try {
    const availabilityCommand = new CheckDomainAvailabilityCommand({
      DomainName: domain,
    });
    const availabilityResponse = await client.send(availabilityCommand);

    let result;

    if (availabilityResponse.Availability === "AVAILABLE") {
      const prices = await getDomainPrice(domainTLD);
      result = {
        available: true,
        prices,
        message: `Domain ${domain} is available`,
      };
    } else {
      const suggestionsCommand = new GetDomainSuggestionsCommand({
        DomainName: domain,
        OnlyAvailable: true,
        SuggestionCount: 20,
      });
      const suggestionsResponse = await client.send(suggestionsCommand);

      const suggestionsWithPrices = await Promise.allSettled(
        (suggestionsResponse.SuggestionsList || []).map(async (suggestion) => {
          const suggestionTLD = getTLD(suggestion.DomainName);
          if (isSupportedTLD(suggestionTLD)) {
            const prices = await getDomainPrice(suggestionTLD);
            return { DomainName: suggestion.DomainName, prices };
          }
        })
      );

      result = {
        available: false,
        suggestions: suggestionsWithPrices
          .filter(({ status }) => status === "fulfilled")
          .map(({ value }) => value),
      };
    }

    domainAvailabilityCache.set(domain, result);
    return result;
  } catch (error) {
    console.error("Error checking domain availability:", error);
    throw error;
  }
}

module.exports = checkDomainExists;
