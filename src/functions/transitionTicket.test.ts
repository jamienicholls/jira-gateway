import { HttpRequest, InvocationContext } from "@azure/functions";
import { transitionTicketHandler } from "./transitionTicket";
import { getTicketTransitions, transitionTicket } from "../services/jiraService";
import { JiraTransition } from "../types/jira";

// Mock the service layer — these tests exercise the HANDLER: auth, validation,
// status-code mapping. The real Jira call is never made.
jest.mock("../services/jiraService");
const mockGetTicketTransitions = getTicketTransitions as jest.MockedFunction<
  typeof getTicketTransitions
>;
const mockTransitionTicket = transitionTicket as jest.MockedFunction<
  typeof transitionTicket
>;

const mockTransitions: JiraTransition[] = [
  { id: "21", name: "In Progress" },
  { id: "41", name: "Done" },
];

// Pass body: undefined to simulate a malformed payload — request.json() throws.
function makeRequest(
  params: Record<string, string>,
  body: unknown,
  apiKey: string | null
): HttpRequest {
  return {
    params,
    json: async () => {
      if (body === undefined) throw new Error("Unexpected end of JSON input");
      return body;
    },
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-api-key" ? apiKey : null,
    },
  } as unknown as HttpRequest;
}

const context = { log: jest.fn() } as unknown as InvocationContext;

describe("transitionTicketHandler", () => {
  beforeEach(() => {
    process.env.API_KEY = "test-key";
    mockGetTicketTransitions.mockReset();
    mockTransitionTicket.mockReset();
  });

  it("returns 204 and transitions the ticket for a valid request", async () => {
    mockGetTicketTransitions.mockResolvedValue(mockTransitions);
    mockTransitionTicket.mockResolvedValue(undefined);

    const res = await transitionTicketHandler(
      makeRequest({ ticketId: "TEST-1" }, { status: "in progress" }, "test-key"),
      context
    );

    expect(res.status).toBe(204);
    expect(res.jsonBody).toBeUndefined();
    expect(mockGetTicketTransitions).toHaveBeenCalledWith("TEST-1");
    expect(mockTransitionTicket).toHaveBeenCalledWith("TEST-1", "21");
  });

  it("returns 401 when the API key is missing", async () => {
    const res = await transitionTicketHandler(
      makeRequest({ ticketId: "TEST-1" }, { status: "Done" }, null),
      context
    );

    expect(res.status).toBe(401);
    expect(mockGetTicketTransitions).not.toHaveBeenCalled();
  });

  it("returns 401 when the API key is wrong", async () => {
    const res = await transitionTicketHandler(
      makeRequest({ ticketId: "TEST-1" }, { status: "Done" }, "wrong-key"),
      context
    );

    expect(res.status).toBe(401);
    expect(mockGetTicketTransitions).not.toHaveBeenCalled();
  });

  it("returns 500 when API_KEY is not configured on the server", async () => {
    delete process.env.API_KEY;

    const res = await transitionTicketHandler(
      makeRequest({ ticketId: "TEST-1" }, { status: "Done" }, "test-key"),
      context
    );

    expect(res.status).toBe(500);
    expect(mockGetTicketTransitions).not.toHaveBeenCalled();
  });

  it("returns 400 when ticketId is missing", async () => {
    const res = await transitionTicketHandler(
      makeRequest({}, { status: "Done" }, "test-key"),
      context
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "ticketId path parameter is required" });
    expect(mockGetTicketTransitions).not.toHaveBeenCalled();
  });

  it("returns 400 when the JSON body is malformed", async () => {
    const res = await transitionTicketHandler(
      makeRequest({ ticketId: "TEST-1" }, undefined, "test-key"),
      context
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "Invalid JSON body" });
    expect(mockGetTicketTransitions).not.toHaveBeenCalled();
  });

  it("returns 400 when status is missing from the payload", async () => {
    const res = await transitionTicketHandler(
      makeRequest({ ticketId: "TEST-1" }, {}, "test-key"),
      context
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "status is required" });
    expect(mockGetTicketTransitions).not.toHaveBeenCalled();
  });

  it("returns 400 when status is only whitespace", async () => {
    const res = await transitionTicketHandler(
      makeRequest({ ticketId: "TEST-1" }, { status: "   " }, "test-key"),
      context
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "status is required" });
    expect(mockGetTicketTransitions).not.toHaveBeenCalled();
  });

  it("returns 422 with availableStatuses when no transition matches", async () => {
    mockGetTicketTransitions.mockResolvedValue(mockTransitions);

    const res = await transitionTicketHandler(
      makeRequest({ ticketId: "TEST-1" }, { status: "Blocked" }, "test-key"),
      context
    );

    expect(res.status).toBe(422);
    expect(res.jsonBody).toEqual({
      error: "Cannot transition to 'Blocked'",
      availableStatuses: ["In Progress", "Done"],
    });
    expect(mockTransitionTicket).not.toHaveBeenCalled();
  });

  it("returns 404 when Jira does not know the ticket", async () => {
    mockGetTicketTransitions.mockRejectedValue({
      response: { status: 404 },
      message: "Request failed with status code 404",
    });

    const res = await transitionTicketHandler(
      makeRequest({ ticketId: "NOPE-1" }, { status: "Done" }, "test-key"),
      context
    );

    expect(res.status).toBe(404);
    expect(res.jsonBody).toEqual({ error: "Ticket NOPE-1 not found" });
  });

  it("returns 500 on any other Jira failure", async () => {
    mockGetTicketTransitions.mockRejectedValue(new Error("connection reset"));

    const res = await transitionTicketHandler(
      makeRequest({ ticketId: "TEST-1" }, { status: "Done" }, "test-key"),
      context
    );

    expect(res.status).toBe(500);
  });
});
