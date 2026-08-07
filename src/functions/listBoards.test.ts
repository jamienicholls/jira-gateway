import { HttpRequest, InvocationContext } from "@azure/functions";
import { listBoardsHandler } from "./listBoards";
import { listJiraBoards } from "../services/jiraService";
import { JiraBoard } from "../types/jira";

// Mock the service layer — these tests exercise the HANDLER: auth, validation,
// status-code mapping. The real Jira call is never made.
jest.mock("../services/jiraService");
const mockListJiraBoards = listJiraBoards as jest.MockedFunction<typeof listJiraBoards>;

const mockBoards: JiraBoard[] = [
  {
    id: 1,
    name: "Test Board",
    type: "scrum",
    projectKey: "TEST",
  },
];

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

describe("listBoardsHandler", () => {
  beforeEach(() => {
    process.env.API_KEY = "test-key";
    mockListJiraBoards.mockReset();
  });

  it("returns 200 with the boards for a valid request", async () => {
    mockListJiraBoards.mockResolvedValue(mockBoards);

    const res = await listBoardsHandler(makeRequest({}, "test-key"), context);

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual(mockBoards);
    expect(mockListJiraBoards).toHaveBeenCalledWith({
      projectKeyOrId: undefined,
      type: undefined,
    });
  });

  it("passes the optional filters through to the service", async () => {
    mockListJiraBoards.mockResolvedValue(mockBoards);

    const res = await listBoardsHandler(
      makeRequest({ projectKeyOrId: "TEST", type: "scrum" }, "test-key"),
      context
    );

    expect(res.status).toBe(200);
    expect(mockListJiraBoards).toHaveBeenCalledWith({
      projectKeyOrId: "TEST",
      type: "scrum",
    });
  });

  it.each(["scrum", "kanban", "simple"])("accepts type=%s", async (type) => {
    mockListJiraBoards.mockResolvedValue([]);

    const res = await listBoardsHandler(makeRequest({ type }, "test-key"), context);

    expect(res.status).toBe(200);
    expect(mockListJiraBoards).toHaveBeenCalledWith({
      projectKeyOrId: undefined,
      type,
    });
  });

  it("omits projectKey for a board that has no project location", async () => {
    mockListJiraBoards.mockResolvedValue([
      { id: 2, name: "Unscoped Board", type: "kanban" },
    ]);

    const res = await listBoardsHandler(makeRequest({}, "test-key"), context);

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual([
      { id: 2, name: "Unscoped Board", type: "kanban" },
    ]);
  });

  it("returns 400 when type is not a board type Jira recognises", async () => {
    const res = await listBoardsHandler(
      makeRequest({ type: "foo" }, "test-key"),
      context
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({
      error: 'type must be "scrum", "kanban" or "simple"',
    });
    expect(mockListJiraBoards).not.toHaveBeenCalled();
  });

  it("returns 401 when the API key is missing", async () => {
    const res = await listBoardsHandler(makeRequest({}, null), context);

    expect(res.status).toBe(401);
    expect(mockListJiraBoards).not.toHaveBeenCalled();
  });

  it("returns 401 when the API key is wrong", async () => {
    const res = await listBoardsHandler(makeRequest({}, "wrong-key"), context);

    expect(res.status).toBe(401);
    expect(mockListJiraBoards).not.toHaveBeenCalled();
  });

  it("returns 500 when API_KEY is not configured on the server", async () => {
    delete process.env.API_KEY;

    const res = await listBoardsHandler(makeRequest({}, "test-key"), context);

    expect(res.status).toBe(500);
    expect(mockListJiraBoards).not.toHaveBeenCalled();
  });

  it("returns an empty array when Jira has no boards", async () => {
    mockListJiraBoards.mockResolvedValue([]);

    const res = await listBoardsHandler(makeRequest({}, "test-key"), context);

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual([]);
  });

  it("returns 400 when Jira rejects the request", async () => {
    mockListJiraBoards.mockRejectedValue({
      response: { status: 400 },
      message: "Request failed with status code 400",
    });

    const res = await listBoardsHandler(
      makeRequest({ projectKeyOrId: "NOPE" }, "test-key"),
      context
    );

    expect(res.status).toBe(400);
  });

  it("returns 500 on any other Jira failure", async () => {
    mockListJiraBoards.mockRejectedValue(new Error("connection reset"));

    const res = await listBoardsHandler(makeRequest({}, "test-key"), context);

    expect(res.status).toBe(500);
  });
});
