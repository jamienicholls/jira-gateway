import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getJiraTicket } from "../services/jiraService";
import { validateApiKey } from "../middleware/auth";

// Exported so it can be unit tested directly — see getTicket.test.ts
export async function getTicketHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`GetTicket triggered — ticketId: ${request.params.ticketId}`);

  const authError = validateApiKey(request);
  if (authError) return authError;

  const { ticketId } = request.params;
  if (!ticketId) {
    return { status: 400, jsonBody: { error: "ticketId path parameter is required" } };
  }

  try {
    const ticket = await getJiraTicket(ticketId);
    return { status: 200, jsonBody: ticket };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status: number }; message: string };
    context.log(`Error fetching ticket ${ticketId}:`, axiosError.message);

    if (axiosError.response?.status === 404) {
      return { status: 404, jsonBody: { error: `Ticket ${ticketId} not found` } };
    }

    return { status: 500, jsonBody: { error: "Failed to fetch ticket from Jira" } };
  }
}

app.http("getTicket", {
  methods: ["GET"],
  route: "ticket/{ticketId}",
  authLevel: "anonymous",
  handler: getTicketHandler,
});
