# jira-gateway — Agent Instructions

## Project Overview
jira-gateway is an Azure Function App (TypeScript, v4 model) that acts as a
REST API wrapper over the Jira REST API. This is a PoC for agentic development.

## Tech Stack
- Runtime: Node.js 24 LTS
- Framework: Azure Functions v4 (@azure/functions package)
- Language: TypeScript — strict mode is ON, no implicit any
- Jira Auth: Basic auth using Base64(email:api_token)
- Gateway Auth: x-api-key request header
- Testing: Jest + ts-jest
- CI/CD: GitHub Actions → Azure Functions (Flex Consumption plan)

## Code Structure — Follow This Exactly
- All Azure Function handlers go in `src/functions/` — one file per endpoint
- All Jira API calls go through `src/services/jiraService.ts` — NEVER call Jira directly from a handler
- All TypeScript interfaces go in `src/types/jira.ts`
- API key validation goes through `src/middleware/auth.ts`

## Rules For Every New Endpoint
1. Create a new file in `src/functions/` named after the operation (e.g. `listProjects.ts`)
2. Call `validateApiKey(request)` at the very start of every handler — return immediately if it fails
3. **Export the handler function** (e.g. `export async function listProjectsHandler(...)`) and register the route with `app.http()` at the bottom of the file — exported handlers are what the tests call
4. Add any new Jira API calls as exported functions in `src/services/jiraService.ts`
5. Add TypeScript interfaces for any new response types to `src/types/jira.ts`
6. Write Jest tests in a `.test.ts` file alongside the function — follow the pattern in `src/functions/getTicket.test.ts`: mock `jiraService`, invoke the exported handler with a fake request, and assert on status codes. Cover at minimum the success case, the auth failure (401), and one error case (e.g. missing param → 400). Tests that only assert on a mock's own return value are worthless — test the handler.

## Dependencies
- **Do not add, remove, or upgrade any npm dependency.** All dependencies are pinned exactly.
  If a ticket seems to require a new package, stop and say so in the PR description instead —
  the human decides dependency changes.

## Git Workflow
- Always create a feature branch from main
- Branch naming: `feat/<feature-name>` or `fix/<fix-name>`
- NEVER commit directly to main
- PR title: short, imperative (e.g. "Add GET /projects endpoint")
- PR description must include: what changed, why, and the Jira ticket key

## Environment Variables (available via process.env)
- `JIRA_BASE_URL` — Jira base URL e.g. https://yoursite.atlassian.net
- `JIRA_EMAIL` — Jira account email
- `JIRA_API_TOKEN` — Jira API token
- `API_KEY` — Gateway API key for validating incoming requests

Never hardcode these. Never log them. Never include them in responses.

## What Not To Do
- Do not use `any` type unless absolutely unavoidable
- Do not commit `local.settings.json` or `.env`
- Do not call the Jira API directly from function handlers — use jiraService.ts
- Do not skip the auth middleware on any endpoint
- Do not commit to main directly
- Do not add npm dependencies (see Dependencies above)

## Testing
- Use Jest with ts-jest; run with `npm test` (or `npm run test:coverage`)
- Mock `jiraService.ts` in handler tests; call the exported handler directly
- Build must pass (`npm run build`) and all tests must pass before opening a PR
