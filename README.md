# jira-gateway

An Azure Function App (TypeScript v4) acting as a REST API wrapper over the Jira API.
Built as a PoC for **agentic development** — every endpoint after the first was
implemented by Claude Code from a Jira ticket, with no human-written implementation code.

## Blog Posts

- [Part 1 — Learning Agentic Software Development: An Engineering Experiment](https://blog.jamienicholls.co.nz/2026/08/06/learning-agentic-software-development-an-engineering-experiment/)
- Part 2 — *coming soon*

## Endpoints

| Method | Route | Description | Author |
|---|---|---|---|
| GET | `/api/ticket/{ticketId}` | Get a Jira ticket | Human (seed) |
| GET | `/api/projects` | List Jira projects | Claude Code |
| POST | `/api/ticket` | Create a ticket | Claude Code |
| GET | `/api/boards?projectKeyOrId=&type=` | List boards (optional filters; `type` is `scrum`, `kanban` or `simple`) | Claude Code |
| GET | `/api/tickets?jql=...` | Search tickets by JQL | Claude Code |

## Auth

All endpoints require an `x-api-key` header.

## Tech Stack

- Azure Functions v4 (TypeScript, strict mode)
- Node.js 24 LTS
- Claude Code — agentic implementation
- GitHub Actions — CI/CD to Azure

## Local Development

```bash
npm ci
cp .env.example .env                 # values for test.http (REST Client)
# put real values in local.settings.json (gitignored — see .env.example)
npm start                            # build + func start on http://localhost:7071
npm test
```

Secrets live only in `local.settings.json`, `.env`, GitHub repository secrets, and
Azure app settings — never in this repo.
