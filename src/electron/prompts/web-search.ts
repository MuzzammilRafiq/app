export const createWebSearchQueriesPrompt = (userQuery: string) => `
You are a search query optimizer for web search.
Given a user's question or request, generate 3-4 different search queries that would help find relevant information on the internet.

Guidelines:
- Make queries specific and searchable
- Use different phrasings to capture different aspects
- Include relevant keywords that might appear in web pages
- Keep queries concise but informative

User query: "${userQuery}"
`;