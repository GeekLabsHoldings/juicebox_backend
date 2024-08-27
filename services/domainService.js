const { Route53DomainsClient, GetDomainSuggestionsCommand } = require('@aws-sdk/client-route-53-domains');
const { ACCESS_KEY_ID, SECRET_ACCESS_KEY, REGION } = process.env;

const client = new Route53DomainsClient({
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  region: REGION,    
});

async function checkDomainExists(domain) {
  try {
    const command = new GetDomainSuggestionsCommand({ DomainName:domain,OnlyAvailable:true,SuggestionCount:10 });
    const response = await client.send(command);
    console.log(response);

    // Check if domain exists in suggestions (replace with proper logic if needed)
    return response;
  } catch (error) {
    console.error('Error checking domain:', error);
    throw error;
  }
}

module.exports = checkDomainExists;
