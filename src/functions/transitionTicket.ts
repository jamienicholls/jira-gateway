import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getTicketTransitions, transitionTicket } from "../services/jiraService";
import { validateApiKey } from "../middleware/auth";
import { TransitionTicketRequest } from "../types/jira";

function isMissing(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

// Exported so it can be unit tested directly — see transitionTicket.test.ts
export async function transitionTicketHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`TransitionTicket triggered — ticketId: ${request.params.ticketId}`);

  const authError = validateApiKey(request);
  if (authError) return authError;

  const { ticketId } = request.params;
  if (!ticketId) {
    return { status: 400, jsonBody: { error: "ticketId path parameter is required" } };
  }

  let body: Partial<TransitionTicketRequest>;
  try {
    body = (await request.json()) as Partial<TransitionTicketRequest>;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  if (isMissing(body?.status)) {
    return { status: 400, jsonBody: { error: "status is required" } };
  }

  const status = body.status as string;

  try {
    const transitions = await getTicketTransitions(ticketId);
    const match = transitions.find(
      (t) => t.name.toLowerCase() === status.toLowerCase()
    );

    if (!match) {
      return {
        status: 422,
        jsonBody: {
          error: `Cannot transition to '${status}'`,
          availableStatuses: transitions.map((t) => t.name),
        },
      };
    }

    await transitionTicket(ticketId, match.id);
    return { status: 204 };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status: number }; message: string };
    context.log(`Error transitioning ticket ${ticketId}:`, axiosError.message);

    if (axiosError.response?.status === 404) {
      return { status: 404, jsonBody: { error: `Ticket ${ticketId} not found` } };
    }

    return { status: 500, jsonBody: { error: "Failed to transition the ticket in Jira" } };
  }
}

app.http("transitionTicket", {
  methods: ["POST"],
  route: "ticket/{ticketId}/transition",
  authLevel: "anonymous",
  handler: transitionTicketHandler,
});
