export interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  priority: string;
  description: unknown;
  created: string;
  updated: string;
  url: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  type: string;
  style: string;
}

export interface CreateTicketRequest {
  projectKey: string;
  summary: string;
  issueType: string;
  description?: string;
  priority?: string;
}

export interface CreatedTicket {
  id: string;
  key: string;
  url: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
  projectKey: string;
}
