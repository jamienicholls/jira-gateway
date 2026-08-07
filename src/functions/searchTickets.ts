import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { searchJiraTickets } from "../services/jiraService";
import { validateApiKey } from "../middleware/auth";

const DEFAULT_MAX_RESULTS = 50;
const MAX_MAX_RESULTS = 100;

// Exported so it can be unit tested directly — see searchTickets.test.ts
export async function searchTicketsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("SearchTickets triggered");

  const authError = validateApiKey(request);
  if (authError) return authError;

  const jql = request.query.get("jql");
  if (!jql) {
    return { status: 400, jsonBody: { error: "jql query parameter is required" } };
  }

  let maxResults = DEFAULT_MAX_RESULTS;
  const maxResultsParam = request.query.get("maxResults");
  if (maxResultsParam) {
    const parsed = parseInt(maxResultsParam, 10);
    if (!Number.isNaN(parsed)) {
      maxResults = Math.min(parsed, MAX_MAX_RESULTS);
    }
  }

  const nextPageToken = request.query.get("nextPageToken") ?? undefined;

  try {
    const result = await searchJiraTickets(jql, maxResults, nextPageToken);
    return { status: 200, jsonBody: result };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status: number }; message: string };
    context.log("Error searching tickets:", axiosError.message);

    // Jira answers invalid JQL with a 400 — the caller's mistake, not a gateway failure.
    if (axiosError.response?.status === 400) {
      return {
        status: 400,
        jsonBody: { error: "Jira rejected the request — check jql syntax" },
      };
    }

    return { status: 500, jsonBody: { error: "Failed to search tickets in Jira" } };
  }
}

app.http("searchTickets", {
  methods: ["GET"],
  route: "tickets",
  authLevel: "anonymous",
  handler: searchTicketsHandler,
});
