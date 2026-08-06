import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { createJiraTicket } from "../services/jiraService";
import { validateApiKey } from "../middleware/auth";
import { CreateTicketRequest } from "../types/jira";

function isMissing(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

// Exported so it can be unit tested directly — see createTicket.test.ts
export async function createTicketHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("CreateTicket triggered");

  const authError = validateApiKey(request);
  if (authError) return authError;

  let body: Partial<CreateTicketRequest>;
  try {
    body = (await request.json()) as Partial<CreateTicketRequest>;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  if (isMissing(body?.projectKey)) {
    return { status: 400, jsonBody: { error: "projectKey is required" } };
  }
  if (isMissing(body.summary)) {
    return { status: 400, jsonBody: { error: "summary is required" } };
  }
  if (isMissing(body.issueType)) {
    return { status: 400, jsonBody: { error: "issueType is required" } };
  }

  try {
    const created = await createJiraTicket(body as CreateTicketRequest);
    return { status: 201, jsonBody: created };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status: number }; message: string };
    context.log(`Error creating ticket in ${body.projectKey}:`, axiosError.message);

    // Jira rejects unknown project keys, issue types and priorities with a 400 —
    // that is the caller's mistake, not a gateway failure.
    if (axiosError.response?.status === 400) {
      return {
        status: 400,
        jsonBody: {
          error: "Jira rejected the ticket — check projectKey, issueType and priority",
        },
      };
    }

    return { status: 500, jsonBody: { error: "Failed to create ticket in Jira" } };
  }
}

app.http("createTicket", {
  methods: ["POST"],
  route: "ticket",
  authLevel: "anonymous",
  handler: createTicketHandler,
});
