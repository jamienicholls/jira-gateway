import { HttpRequest, InvocationContext } from "@azure/functions";
import { addCommentHandler } from "./addComment";
import { addJiraComment } from "../services/jiraService";
import { CreatedComment } from "../types/jira";

// Mock the service layer — these tests exercise the HANDLER: auth, validation,
// status-code mapping. The real Jira call is never made.
jest.mock("../services/jiraService");
const mockAddJiraComment = addJiraComment as jest.MockedFunction<typeof addJiraComment>;

const mockComment: CreatedComment = {
  id: "10100",
  ticketKey: "TEST-1",
  body: "Looks good to me",
  author: "Jamie Nicholls",
  created: "2026-01-01T00:00:00.000Z",
  url: "https://test.atlassian.net/browse/TEST-1?focusedCommentId=10100",
};

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

describe("addCommentHandler", () => {
  beforeEach(() => {
    process.env.API_KEY = "test-key";
    mockAddJiraComment.mockReset();
  });

  it("returns 201 with the created comment for a valid request", async () => {
    mockAddJiraComment.mockResolvedValue(mockComment);

    const res = await addCommentHandler(
      makeRequest({ ticketId: "TEST-1" }, { body: "Looks good to me" }, "test-key"),
      context
    );

    expect(res.status).toBe(201);
    expect(res.jsonBody).toEqual(mockComment);
    expect(mockAddJiraComment).toHaveBeenCalledWith("TEST-1", "Looks good to me");
  });

  it("returns 401 when the API key is missing", async () => {
    const res = await addCommentHandler(
      makeRequest({ ticketId: "TEST-1" }, { body: "Hello" }, null),
      context
    );

    expect(res.status).toBe(401);
    expect(mockAddJiraComment).not.toHaveBeenCalled();
  });

  it("returns 401 when the API key is wrong", async () => {
    const res = await addCommentHandler(
      makeRequest({ ticketId: "TEST-1" }, { body: "Hello" }, "wrong-key"),
      context
    );

    expect(res.status).toBe(401);
    expect(mockAddJiraComment).not.toHaveBeenCalled();
  });

  it("returns 500 when API_KEY is not configured on the server", async () => {
    delete process.env.API_KEY;

    const res = await addCommentHandler(
      makeRequest({ ticketId: "TEST-1" }, { body: "Hello" }, "test-key"),
      context
    );

    expect(res.status).toBe(500);
    expect(mockAddJiraComment).not.toHaveBeenCalled();
  });

  it("returns 400 when ticketId is missing", async () => {
    const res = await addCommentHandler(
      makeRequest({}, { body: "Hello" }, "test-key"),
      context
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "ticketId path parameter is required" });
    expect(mockAddJiraComment).not.toHaveBeenCalled();
  });

  it("returns 400 when the JSON body is malformed", async () => {
    const res = await addCommentHandler(
      makeRequest({ ticketId: "TEST-1" }, undefined, "test-key"),
      context
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "Invalid JSON body" });
    expect(mockAddJiraComment).not.toHaveBeenCalled();
  });

  it("returns 400 when body is missing from the payload", async () => {
    const res = await addCommentHandler(
      makeRequest({ ticketId: "TEST-1" }, {}, "test-key"),
      context
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "body is required" });
    expect(mockAddJiraComment).not.toHaveBeenCalled();
  });

  it("returns 400 when body is only whitespace", async () => {
    const res = await addCommentHandler(
      makeRequest({ ticketId: "TEST-1" }, { body: "   " }, "test-key"),
      context
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: "body is required" });
    expect(mockAddJiraComment).not.toHaveBeenCalled();
  });

  it("returns 404 when Jira does not know the ticket", async () => {
    mockAddJiraComment.mockRejectedValue({
      response: { status: 404 },
      message: "Request failed with status code 404",
    });

    const res = await addCommentHandler(
      makeRequest({ ticketId: "NOPE-1" }, { body: "Hello" }, "test-key"),
      context
    );

    expect(res.status).toBe(404);
    expect(res.jsonBody).toEqual({ error: "Ticket NOPE-1 not found" });
  });

  it("returns 400 when Jira rejects the comment", async () => {
    mockAddJiraComment.mockRejectedValue({
      response: { status: 400 },
      message: "Request failed with status code 400",
    });

    const res = await addCommentHandler(
      makeRequest({ ticketId: "TEST-1" }, { body: "Hello" }, "test-key"),
      context
    );

    expect(res.status).toBe(400);
  });

  it("returns 500 on any other Jira failure", async () => {
    mockAddJiraComment.mockRejectedValue(new Error("connection reset"));

    const res = await addCommentHandler(
      makeRequest({ ticketId: "TEST-1" }, { body: "Hello" }, "test-key"),
      context
    );

    expect(res.status).toBe(500);
  });
});
