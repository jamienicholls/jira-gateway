import axios, { AxiosInstance } from "axios";
import { JiraTicket, JiraProject } from "../types/jira";

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
