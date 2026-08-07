import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { addJiraComment } from "../services/jiraService";
import { validateApiKey } from "../middleware/auth";
import { AddCommentRequest } from "../types/jira";

function isMissing(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

// Exported so it can be unit tested directly — see addComment.test.ts
export async function addCommentHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`AddComment triggered — ticketId: ${request.params.ticketId}`);

  const authError = validateApiKey(request);
  if (authError) return authError;

  const { ticketId } = request.params;
  if (!ticketId) {
    return { status: 400, jsonBody: { error: "ticketId path parameter is required" } };
  }

  let body: Partial<AddCommentRequest>;
  try {
    body = (await request.json()) as Partial<AddCommentRequest>;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  if (isMissing(body?.body)) {
    return { status: 400, jsonBody: { error: "body is required" } };
  }

  try {
    const comment = await addJiraComment(ticketId, body.body as string);
    return { status: 201, jsonBody: comment };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status: number }; message: string };
    context.log(`Error adding comment to ticket ${ticketId}:`, axiosError.message);

    if (axiosError.response?.status === 404) {
      return { status: 404, jsonBody: { error: `Ticket ${ticketId} not found` } };
    }

    // Jira rejects malformed ticket keys and comment bodies with a 400 —
    // that is the caller's mistake, not a gateway failure.
    if (axiosError.response?.status === 400) {
      return {
        status: 400,
        jsonBody: {
          error: "Jira rejected the comment — check the ticket key and comment body",
        },
      };
    }

    return { status: 500, jsonBody: { error: "Failed to add comment to the ticket in Jira" } };
  }
}

app.http("addComment", {
  methods: ["POST"],
  route: "ticket/{ticketId}/comment",
  authLevel: "anonymous",
  handler: addCommentHandler,
});
