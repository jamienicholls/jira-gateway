import { HttpRequest, InvocationContext } from "@azure/functions";
import { getTicketHandler } from "./getTicket";
import { getJiraTicket } from "../services/jiraService";
import { JiraTicket } from "../types/jira";

// Mock the service layer — these tests exercise the HANDLER: auth, validation,
// status-code mapping. The real Jira call is never made.
jest.mock("../services/jiraService");
const mockGetJiraTicket = getJiraTicket as jest.MockedFunction<typeof getJiraTicket>;

const mockTicket: JiraTicket = {
  id: "10001",
  key: "TEST-1",
  summary: "Test ticket summary",
  status: "To Do",
  assignee: "Jamie Nicholls",
  priority: "Medium",
  description: null,
  created: "2026-01-01T00:00:00.000Z",
  updated: "2026-01-01T00:00:00.000Z",
  url: "https://test.atlassian.net/browse/TEST-1",
};

function makeRequest(
  params: Record<string, string>,
  apiKey: string | null
): HttpRequest {
  return {
    params,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-api-key" ? apiKey : null,
    },
  } as unknown as HttpRequest;
}

const context = { log: jest.fn() } as unknown as InvocationContext;

describe("getTicketHandler", () => {
  beforeEach(() => {
    process.env.API_KEY = "test-key";
    mockGetJiraTicket.mockReset();
  });

  it("returns 200 with the ticket for a valid request", async () => {
    mockGetJiraTicket.mockResolvedValue(mockTicket);

    const res = await getTicketHandler(makeRequest({ ticketId: "TEST-1" }, "test-key"), context);

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual(mockTicket);
    expect(mockGetJiraTicket).toHaveBeenCalledWith("TEST-1");
  });

  it("returns 401 when the API key is missing", async () => {
    const res = await getTicketHandler(makeRequest({ ticketId: "TEST-1" }, null), context);

    expect(res.status).toBe(401);
    expect(mockGetJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 401 when the API key is wrong", async () => {
    const res = await getTicketHandler(makeRequest({ ticketId: "TEST-1" }, "wrong-key"), context);

    expect(res.status).toBe(401);
    expect(mockGetJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 500 when API_KEY is not configured on the server", async () => {
    delete process.env.API_KEY;

    const res = await getTicketHandler(makeRequest({ ticketId: "TEST-1" }, "test-key"), context);

    expect(res.status).toBe(500);
    expect(mockGetJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 400 when ticketId is missing", async () => {
    const res = await getTicketHandler(makeRequest({}, "test-key"), context);

    expect(res.status).toBe(400);
    expect(mockGetJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 404 when Jira does not know the ticket", async () => {
    mockGetJiraTicket.mockRejectedValue({
      response: { status: 404 },
      message: "Request failed with status code 404",
    });

    const res = await getTicketHandler(makeRequest({ ticketId: "NOPE-1" }, "test-key"), context);

    expect(res.status).toBe(404);
  });

  it("returns 500 on any other Jira failure", async () => {
    mockGetJiraTicket.mockRejectedValue(new Error("connection reset"));

    const res = await getTicketHandler(makeRequest({ ticketId: "TEST-1" }, "test-key"), context);

    expect(res.status).toBe(500);
  });
});
