import worker from "../worker/index.js";

export const config = { runtime: "edge" };

function createWorkerRequest(request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("__path") || "";
  url.searchParams.delete("__path");
  url.pathname = "/" + path.replace(/^\/+/, "");

  const headers = new Headers(request.headers);
  headers.set("oai-authenticated-user-id", "vercel-public-visitor");
  headers.set("oai-authenticated-user-email", "visitor@blh-xauusd.local");

  return new Request(url, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
}

export default async function handler(request) {
  return worker.fetch(createWorkerRequest(request), {
    TWELVEDATA_API_KEY: process.env.TWELVEDATA_API_KEY,
  });
}
