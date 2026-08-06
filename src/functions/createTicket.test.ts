import { HttpRequest, InvocationContext } from "@azure/functions";
import { createTicketHandler } from "./createTicket";
import { createJiraTicket } from "../services/jiraService";
import { CreatedTicket } from "../types/jira";

// Mock the service layer — these tests exercise the HANDLER: auth, validation,
// status-code mapping. The real Jira call is never made.
jest.mock("../services/jiraService");
const mockCreateJiraTicket = createJiraTicket as jest.MockedFunction<typeof createJiraTicket>;

const mockCreated: CreatedTicket = {
  id: "10002",
  key: "TEST-2",
  url: "https://test.atlassian.net/browse/TEST-2",
};

const validBody = {
  projectKey: "TEST",
  summary: "My ticket",
  issueType: "Task",
};

function makeRequest(body: unknown, apiKey: string | null): HttpRequest {
  return {
    params: {},
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-api-key" ? apiKey : null,
    },
    json: () => Promise.resolve(body),
  } as unknown as HttpRequest;
}

function makeBadJsonRequest(apiKey: string | null): HttpRequest {
  return {
    params: {},
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-api-key" ? apiKey : null,
    },
    json: () => Promise.reject(new SyntaxError("Unexpected token")),
  } as unknown as HttpRequest;
}

const context = { log: jest.fn() } as unknown as InvocationContext;

describe("createTicketHandler", () => {
  beforeEach(() => {
    process.env.API_KEY = "test-key";
    mockCreateJiraTicket.mockReset();
  });

  it("returns 201 with the created ticket for a valid request", async () => {
    mockCreateJiraTicket.mockResolvedValue(mockCreated);

    const res = await createTicketHandler(makeRequest(validBody, "test-key"), context);

    expect(res.status).toBe(201);
    expect(res.jsonBody).toEqual(mockCreated);
    expect(mockCreateJiraTicket).toHaveBeenCalledWith(validBody);
  });

  it("passes the optional description and priority through to the service", async () => {
    mockCreateJiraTicket.mockResolvedValue(mockCreated);
    const body = { ...validBody, description: "some detail", priority: "Medium" };

    const res = await createTicketHandler(makeRequest(body, "test-key"), context);

    expect(res.status).toBe(201);
    expect(mockCreateJiraTicket).toHaveBeenCalledWith(body);
  });

  it("returns 400 when projectKey is missing", async () => {
    const { projectKey: _omitted, ...body } = validBody;

    const res = await createTicketHandler(makeRequest(body, "test-key"), context);

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "projectKey is required" });
    expect(mockCreateJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 400 when summary is missing", async () => {
    const { summary: _omitted, ...body } = validBody;

    const res = await createTicketHandler(makeRequest(body, "test-key"), context);

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "summary is required" });
    expect(mockCreateJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 400 when issueType is missing", async () => {
    const { issueType: _omitted, ...body } = validBody;

    const res = await createTicketHandler(makeRequest(body, "test-key"), context);

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "issueType is required" });
    expect(mockCreateJiraTicket).not.toHaveBeenCalled();
  });

  it("treats a blank summary as missing", async () => {
    const res = await createTicketHandler(
      makeRequest({ ...validBody, summary: "   " }, "test-key"),
      context
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "summary is required" });
    expect(mockCreateJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const res = await createTicketHandler(makeBadJsonRequest("test-key"), context);

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "Invalid JSON body" });
    expect(mockCreateJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 401 when the API key is missing", async () => {
    const res = await createTicketHandler(makeRequest(validBody, null), context);

    expect(res.status).toBe(401);
    expect(mockCreateJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 401 when the API key is wrong", async () => {
    const res = await createTicketHandler(makeRequest(validBody, "wrong-key"), context);

    expect(res.status).toBe(401);
    expect(mockCreateJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 500 when API_KEY is not configured on the server", async () => {
    delete process.env.API_KEY;

    const res = await createTicketHandler(makeRequest(validBody, "test-key"), context);

    expect(res.status).toBe(500);
    expect(mockCreateJiraTicket).not.toHaveBeenCalled();
  });

  it("returns 400 when Jira rejects the ticket", async () => {
    mockCreateJiraTicket.mockRejectedValue({
      response: { status: 400 },
      message: "Request failed with status code 400",
    });

    const res = await createTicketHandler(makeRequest(validBody, "test-key"), context);

    expect(res.status).toBe(400);
  });

  it("returns 500 on any other Jira failure", async () => {
    mockCreateJiraTicket.mockRejectedValue(new Error("connection reset"));

    const res = await createTicketHandler(makeRequest(validBody, "test-key"), context);

    expect(res.status).toBe(500);
  });
});
