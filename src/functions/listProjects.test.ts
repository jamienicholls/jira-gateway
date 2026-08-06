import { HttpRequest, InvocationContext } from "@azure/functions";
import { listProjectsHandler } from "./listProjects";
import { listJiraProjects } from "../services/jiraService";
import { JiraProject } from "../types/jira";

// Mock the service layer — these tests exercise the HANDLER: auth, validation,
// status-code mapping. The real Jira call is never made.
jest.mock("../services/jiraService");
const mockListJiraProjects = listJiraProjects as jest.MockedFunction<typeof listJiraProjects>;

const mockProjects: JiraProject[] = [
  {
    id: "10000",
    key: "TEST",
    name: "Test Project",
    type: "software",
    style: "scrum",
  },
];

function makeRequest(apiKey: string | null): HttpRequest {
  return {
    params: {},
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-api-key" ? apiKey : null,
    },
  } as unknown as HttpRequest;
}

const context = { log: jest.fn() } as unknown as InvocationContext;

describe("listProjectsHandler", () => {
  beforeEach(() => {
    process.env.API_KEY = "test-key";
    mockListJiraProjects.mockReset();
  });

  it("returns 200 with the projects for a valid request", async () => {
    mockListJiraProjects.mockResolvedValue(mockProjects);

    const res = await listProjectsHandler(makeRequest("test-key"), context);

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual(mockProjects);
    expect(mockListJiraProjects).toHaveBeenCalled();
  });

  it("returns 401 when the API key is missing", async () => {
    const res = await listProjectsHandler(makeRequest(null), context);

    expect(res.status).toBe(401);
    expect(mockListJiraProjects).not.toHaveBeenCalled();
  });

  it("returns 401 when the API key is wrong", async () => {
    const res = await listProjectsHandler(makeRequest("wrong-key"), context);

    expect(res.status).toBe(401);
    expect(mockListJiraProjects).not.toHaveBeenCalled();
  });

  it("returns an empty array when Jira has no projects", async () => {
    mockListJiraProjects.mockResolvedValue([]);

    const res = await listProjectsHandler(makeRequest("test-key"), context);

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual([]);
  });

  it("returns 500 on a Jira failure", async () => {
    mockListJiraProjects.mockRejectedValue(new Error("connection reset"));

    const res = await listProjectsHandler(makeRequest("test-key"), context);

    expect(res.status).toBe(500);
  });
});
