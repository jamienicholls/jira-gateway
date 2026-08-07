import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listJiraBoards } from "../services/jiraService";
import { validateApiKey } from "../middleware/auth";

// The Agile API rejects anything else with a 400. JG-4 names only scrum and
// kanban, but "simple" is what next-gen project boards report as their type.
const VALID_BOARD_TYPES = ["scrum", "kanban", "simple"];

// Exported so it can be unit tested directly — see listBoards.test.ts
export async function listBoardsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("ListBoards triggered");

  const authError = validateApiKey(request);
  if (authError) return authError;

  const projectKeyOrId = request.query.get("projectKeyOrId") ?? undefined;
  const type = request.query.get("type") ?? undefined;

  if (type && !VALID_BOARD_TYPES.includes(type)) {
    return {
      status: 400,
      jsonBody: { error: 'type must be "scrum", "kanban" or "simple"' },
    };
  }

  try {
    const boards = await listJiraBoards({ projectKeyOrId, type });
    return { status: 200, jsonBody: boards };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status: number }; message: string };
    context.log("Error fetching boards:", axiosError.message);

    // Jira answers an unknown projectKeyOrId with a 400 — the caller's mistake,
    // not a gateway failure.
    if (axiosError.response?.status === 400) {
      return {
        status: 400,
        jsonBody: { error: "Jira rejected the request — check projectKeyOrId" },
      };
    }

    return { status: 500, jsonBody: { error: "Failed to fetch boards from Jira" } };
  }
}

app.http("listBoards", {
  methods: ["GET"],
  route: "boards",
  authLevel: "anonymous",
  handler: listBoardsHandler,
});
