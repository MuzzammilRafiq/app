export const createRagSearchQueriesPrompt = (userQuery: string) => `
You are a search assistant for a similarity search system.
Given a user query, generate 3 alternative search queries that capture
different ways of asking the same thing. These queries will be used for
similarity search to find relevant documents.

User query: "${userQuery}"
`;