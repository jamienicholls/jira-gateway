import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listJiraProjects } from "../services/jiraService";
import { validateApiKey } from "../middleware/auth";

// Exported so it can be unit tested directly — see listProjects.test.ts
export async function listProjectsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("ListProjects triggered");

  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const projects = await listJiraProjects();
    return { status: 200, jsonBody: projects };
  } catch (error: unknown) {
    const axiosError = error as { message: string };
    context.log("Error fetching projects:", axiosError.message);

    return { status: 500, jsonBody: { error: "Failed to fetch projects from Jira" } };
  }
}

app.http("listProjects", {
  methods: ["GET"],
  route: "projects",
  authLevel: "anonymous",
  handler: listProjectsHandler,
});
