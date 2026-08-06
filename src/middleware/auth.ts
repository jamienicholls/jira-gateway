import { HttpRequest, HttpResponseInit } from "@azure/functions";

export function validateApiKey(request: HttpRequest): HttpResponseInit | null {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    console.error("API_KEY environment variable is not configured");
    return {
      status: 500,
      jsonBody: { error: "Server configuration error" },
    };
  }

  if (!apiKey || apiKey !== expectedKey) {
    return {
      status: 401,
      jsonBody: { error: "Unauthorized — invalid or missing x-api-key header" },
    };
  }

  return null;
}
