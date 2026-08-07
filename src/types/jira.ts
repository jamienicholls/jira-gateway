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
  // Jira only sets location.projectKey for project-scoped boards.
  projectKey?: string;
}

export interface JiraSearchIssue {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  priority: string;
}

export interface JiraSearchResult {
  maxResults: number;
  isLast: boolean;
  // Cursor-based pagination — omitted once isLast is true.
  nextPageToken?: string;
  issues: JiraSearchIssue[];
}

export interface AddCommentRequest {
  body: string;
}

export interface CreatedComment {
  id: string;
  ticketKey: string;
  // Echoes the plain text the caller sent — Jira stores it as ADF.
  body: string;
  author: string;
  created: string;
  url: string;
}

export interface JiraTransition {
  id: string;
  name: string;
}

export interface TransitionTicketRequest {
  status: string;
}
