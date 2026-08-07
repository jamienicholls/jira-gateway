import { HttpRequest, InvocationContext } from "@azure/functions";
import { searchTicketsHandler } from "./searchTickets";
import { searchJiraTickets } from "../services/jiraService";
import { JiraSearchResult } from "../types/jira";

// Mock the service layer — these tests exercise the HANDLER: auth, validation,
// status-code mapping. The real Jira call is never made.
jest.mock("../services/jiraService");
const mockSearchJiraTickets = searchJiraTickets as jest.MockedFunction<typeof searchJiraTickets>;

const mockResult: JiraSearchResult = {
  maxResults: 50,
  isLast: false,
  nextPageToken: "CAEaAggD",
  issues: [
    {
      id: "10001",
      key: "TEST-1",
      summary: "Test ticket summary",
      status: "To Do",
      assignee: "Jamie Nicholls",
      priority: "Medium",
    },
  ],
};

function makeRequest(
  query: Record<string, string>,
  apiKey: string | null
): HttpRequest {
  return {
    params: {},
    query: new URLSearchParams(query),
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-api-key" ? apiKey : null,
    },
  } as unknown as HttpRequest;
}

const context = { log: jest.fn() } as unknown as InvocationContext;

describe("searchTicketsHandler", () => {
  beforeEach(() => {
    process.env.API_KEY = "test-key";
    mockSearchJiraTickets.mockReset();
  });

  it("returns 200 with the search results for a valid request", async () => {
    mockSearchJiraTickets.mockResolvedValue(mockResult);

    const res = await searchTicketsHandler(
      makeRequest({ jql: "project = TEST" }, "test-key"),
      context
    );

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual(mockResult);
    expect(mockSearchJiraTickets).toHaveBeenCalledWith("project = TEST", 50, undefined);
  });

  it("passes nextPageToken through to the service", async () => {
    mockSearchJiraTickets.mockResolvedValue(mockResult);

    const res = await searchTicketsHandler(
      makeRequest({ jql: "project = TEST", nextPageToken: "CAEaAggD" }, "test-key"),
      context
    );

    expect(res.status).toBe(200);
    expect(mockSearchJiraTickets).toHaveBeenCalledWith("project = TEST", 50, "CAEaAggD");
  });

  it("passes a valid maxResults through to the service", async () => {
    mockSearchJiraTickets.mockResolvedValue(mockResult);

    const res = await searchTicketsHandler(
      makeRequest({ jql: "project = TEST", maxResults: "25" }, "test-key"),
      context
    );

    expect(res.status).toBe(200);
    expect(mockSearchJiraTickets).toHaveBeenCalledWith("project = TEST", 25, undefined);
  });

  it("clamps maxResults to 100 when the request exceeds it", async () => {
    mockSearchJiraTickets.mockResolvedValue(mockResult);

    const res = await searchTicketsHandler(
      makeRequest({ jql: "project = TEST", maxResults: "500" }, "test-key"),
      context
    );

    expect(res.status).toBe(200);
    expect(mockSearchJiraTickets).toHaveBeenCalledWith("project = TEST", 100, undefined);
  });

  it("returns 400 when jql is missing", async () => {
    const res = await searchTicketsHandler(makeRequest({}, "test-key"), context);

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "jql query parameter is required" });
    expect(mockSearchJiraTickets).not.toHaveBeenCalled();
  });

  it("returns 401 when the API key is missing", async () => {
    const res = await searchTicketsHandler(
      makeRequest({ jql: "project = TEST" }, null),
      context
    );

    expect(res.status).toBe(401);
    expect(mockSearchJiraTickets).not.toHaveBeenCalled();
  });

  it("returns 401 when the API key is wrong", async () => {
    const res = await searchTicketsHandler(
      makeRequest({ jql: "project = TEST" }, "wrong-key"),
      context
    );

    expect(res.status).toBe(401);
    expect(mockSearchJiraTickets).not.toHaveBeenCalled();
  });

  it("returns 500 when API_KEY is not configured on the server", async () => {
    delete process.env.API_KEY;

    const res = await searchTicketsHandler(
      makeRequest({ jql: "project = TEST" }, "test-key"),
      context
    );

    expect(res.status).toBe(500);
    expect(mockSearchJiraTickets).not.toHaveBeenCalled();
  });

  it("returns 400 when Jira rejects the jql", async () => {
    mockSearchJiraTickets.mockRejectedValue({
      response: { status: 400 },
      message: "Request failed with status code 400",
    });

    const res = await searchTicketsHandler(
      makeRequest({ jql: "not valid jql" }, "test-key"),
      context
    );

    expect(res.status).toBe(400);
  });

  it("returns 500 on any other Jira failure", async () => {
    mockSearchJiraTickets.mockRejectedValue(new Error("connection reset"));

    const res = await searchTicketsHandler(
      makeRequest({ jql: "project = TEST" }, "test-key"),
      context
    );

    expect(res.status).toBe(500);
  });
});
