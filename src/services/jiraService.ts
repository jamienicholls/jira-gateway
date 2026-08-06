import axios, { AxiosInstance } from "axios";
import {
  JiraTicket,
  JiraProject,
  CreateTicketRequest,
  CreatedTicket,
} from "../types/jira";

function createJiraClient(): AxiosInstance {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    throw new Error("Jira environment variables are not fully configured");
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  return axios.create({
    baseURL: `${baseUrl}/rest/api/3`,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
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
