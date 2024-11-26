const {
  CheckDomainAvailabilityCommand,
  GetDomainSuggestionsCommand,
  ListPricesCommand,
} = require('@aws-sdk/client-route-53-domains');
const { route53 } = require('../config/awsConfig');

// Trie Implementation for TLD Mapping
class TrieNode {
  constructor() {
    this.children = {};
    this.isEnd = false;
    this.priceData = null; // To store pricing directly at the node
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(tld, priceData) {
    let node = this.root;
    for (const char of tld) {
      if (!node.children[char]) node.children[char] = new TrieNode();
      node = node.children[char];
    }
    node.isEnd = true;
    node.priceData = priceData;
  }

  search(tld) {
    let node = this.root;
    for (const char of tld) {
      if (!node.children[char]) return null;
      node = node.children[char];
    }
    return node.isEnd ? node.priceData : null;
  }
}

// Utility: Extract TLD
function getTLD(domain) {
  const parts = domain.split('.');
  return parts.pop();
}

// Utility: Rank domain suggestions using a Min-Heap
function rankSuggestions(suggestions) {
  const heap = [];
  for (const suggestion of suggestions) {
    heap.push(suggestion);
  }
  // Sorting by length for simplicity (could be adjusted to other criteria)
  heap.sort((a, b) => a.length - b.length);
  return heap;
}

// Fetch domain suggestions
async function fetchDomainSuggestions(domainName) {
  const command = new GetDomainSuggestionsCommand({
    DomainName: domainName,
    SuggestionCount: 20,
    OnlyAvailable: true,
  });

  const response = await route53.send(command);
  return response.SuggestionsList?.map((s) => s.DomainName) || [];
}

// Fetch prices for TLDs with Trie
async function fetchPricesForTLDs(tlds, trie) {
  const pricePromises = tlds.map(async (tld) => {
    if (trie.search(tld)) return trie.search(tld); // Use Trie for cached results

    try {
      const command = new ListPricesCommand({ Tld: tld });
      const response = await route53.send(command);
      const priceInfo = response.Prices?.[0];
      if (!priceInfo) throw new Error(`No prices found for TLD: ${tld}`);
      const priceData = {
        tld,
        registrationPrice: priceInfo.RegistrationPrice,
        renewalPrice: priceInfo.RenewalPrice,
      };
      trie.insert(tld, priceData); // Cache price in Trie
      return priceData;
    } catch (error) {
      console.warn(`Error fetching prices for .${tld}: ${error.message}`);
      return null;
    }
  });

  const results = await Promise.all(pricePromises);
  return results.filter(Boolean); // Remove null results
}

// Map suggestions with prices using Trie
function mapDomainSuggestionsWithPrices(suggestions, trie) {
  return suggestions
    .map((suggestion) => {
      const tld = getTLD(suggestion);
      const priceData = trie.search(tld);
      return priceData ? { domain: suggestion, prices: priceData } : null;
    })
    .filter(Boolean);
}

// Fetch domain suggestions with pricing
async function getDomainSuggestionsWithPrices(domain, trie) {
  const suggestions = await fetchDomainSuggestions(domain);

  // Get unique TLDs
  const tlds = [...new Set(suggestions.map((s) => getTLD(s)))];
  const prices = await fetchPricesForTLDs(tlds, trie);

  // Rank and map suggestions
  const rankedSuggestions = rankSuggestions(suggestions);
  return mapDomainSuggestionsWithPrices(rankedSuggestions, trie);
}

// Check domain availability
async function checkDomainAvailability(domain) {
  const command = new CheckDomainAvailabilityCommand({ DomainName: domain });
  const response = await route53.send(command);
  return response.Availability === 'AVAILABLE';
}

// Main function: Check domain existence and fetch suggestions/prices
async function checkDomainExists(domain) {
  const trie = new Trie(); // Initialize Trie for price mapping

  try {
    // Fetch availability and suggestions/prices concurrently
    const [isAvailable, suggestionsWithPrices] = await Promise.all([
      checkDomainAvailability(domain),
      getDomainSuggestionsWithPrices(domain, trie),
    ]);

    if (isAvailable) {
      return { available: true, message: `Domain ${domain} is available` };
    }

    return {
      available: false,
      suggestions: suggestionsWithPrices,
      message: `Domain ${domain} is not available`,
    };
  } catch (error) {
    console.error('Error in checkDomainExists:', error.message);
    throw error;
  }
}

module.exports = checkDomainExists;
