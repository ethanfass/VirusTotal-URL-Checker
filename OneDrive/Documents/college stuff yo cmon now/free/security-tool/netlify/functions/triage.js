import "dotenv/config";
import { getQuotaSnapshot, triageIndicator } from "../../lib/triage.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return response(204, "");
  }

  if (event.httpMethod === "GET") {
    return response(200, getQuotaSnapshot());
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const result = await triageIndicator(body);
    return response(200, result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return response(400, { error: "Request body must be valid JSON." });
    }

    const status = error.status || 500;
    const message = status === 500 ? "The analyzer hit a server-side snag." : error.message;
    return response(status, { error: message, details: error.details || null });
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    },
    body: body === "" ? "" : JSON.stringify(body)
  };
}
