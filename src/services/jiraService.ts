import axios, { AxiosInstance } from "axios";
import {
  JiraTicket,
  JiraProject,
  CreateTicketRequest,
  CreatedTicket,
  JiraBoard,
  JiraSearchResult,
} from "../types/jira";

function createJiraClient(apiPath = "/rest/api/3"): AxiosInstance {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    throw new Error("Jira environment variables are not fully configured");
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  return axios.create({
    baseURL: `${baseUrl}${apiPath}`,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
}

// Boards are served by the Agile API, not the standard REST API.
function createJiraAgileClient(): AxiosInstance {
  return createJiraClient("/rest/agile/1.0");
}

export async function getJiraTicket(ticketId: string): Promise<JiraTicket> {
  const client = createJiraClient();
  const response = await client.get(`/issue/${ticketId}`);
  const issue = response.data;

  return {
    id: issue.id,
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name ?? "Unknown",
    assignee: issue.fields.assignee?.displayName ?? "Unassigned",
    priority: issue.fields.priority?.name ?? "None",
    description: issue.fields.description,
    created: issue.fields.created,
    updated: issue.fields.updated,
    url: `${process.env.JIRA_BASE_URL}/browse/${issue.key}`,
  };
}

// Jira REST v3 wants rich text as Atlassian Document Format, not a plain string.
function toAdf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export async function createJiraTicket(
  ticket: CreateTicketRequest
): Promise<CreatedTicket> {
  const client = createJiraClient();

  const fields: Record<string, unknown> = {
    project: { key: ticket.projectKey },
    summary: ticket.summary,
    issuetype: { name: ticket.issueType },
  };

  if (ticket.description) {
    fields.description = toAdf(ticket.description);
  }

  if (ticket.priority) {
    fields.priority = { name: ticket.priority };
  }

  const response = await client.post("/issue", { fields });
  const issue = response.data;

  return {
    id: issue.id,
    key: issue.key,
    url: `${process.env.JIRA_BASE_URL}/browse/${issue.key}`,
  };
}

export async function listJiraProjects(): Promise<JiraProject[]> {
  const client = createJiraClient();
  const response = await client.get("/project");
  const projects = response.data;

  return projects.map((project: {
    id: string;
    key: string;
    name: string;
    projectTypeKey: string;
    style: string;
  }) => ({
    id: project.id,
    key: project.key,
    name: project.name,
    type: project.projectTypeKey,
    style: project.style,
  }));
}

export async function searchJiraTickets(
  jql: string,
  maxResults: number,
  nextPageToken?: string
): Promise<JiraSearchResult> {
  const client = createJiraClient();

  const params: Record<string, string | number> = {
    jql,
    maxResults,
    fields: "summary,status,assignee,priority",
  };
  if (nextPageToken) params.nextPageToken = nextPageToken;

  const response = await client.get("/search/jql", { params });
  const data = response.data;

  const issues = (data.issues ?? []).map((issue: {
    id: string;
    key: string;
    fields: {
      summary: string;
      status?: { name: string };
      assignee?: { displayName: string };
      priority?: { name: string };
    };
  }) => ({
    id: issue.id,
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name ?? "Unknown",
    assignee: issue.fields.assignee?.displayName ?? "Unassigned",
    priority: issue.fields.priority?.name ?? "None",
  }));

  const result: JiraSearchResult = {
    maxResults,
    isLast: data.isLast,
    issues,
  };

  if (!data.isLast && data.nextPageToken) {
    result.nextPageToken = data.nextPageToken;
  }

  return result;
}

export async function listJiraBoards(
  filters: { projectKeyOrId?: string; type?: string } = {}
): Promise<JiraBoard[]> {
  const client = createJiraAgileClient();

  const params: Record<string, string> = {};
  if (filters.projectKeyOrId) params.projectKeyOrId = filters.projectKeyOrId;
  if (filters.type) params.type = filters.type;

  const response = await client.get("/board", { params });

  // The Agile API wraps results in a paged envelope, unlike /rest/api/3/project.
  const boards = response.data.values ?? [];

  return boards.map((board: {
    id: number;
    name: string;
    type: string;
    location?: { projectKey?: string };
  }) => ({
    id: board.id,
    name: board.name,
    type: board.type,
    projectKey: board.location?.projectKey,
  }));
}
