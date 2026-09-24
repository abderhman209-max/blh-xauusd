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

function requestedPath(request) {
  const path = new URL(request.url).searchParams.get("__path") || "";
  return "/" + path.replace(/^\/+/, "");
}

function removeRegressionHeatmap(source) {
  return source
    .replace(
      "[['structure','structureSub','show-structure','signals'],['smart','smartSub','show-smart','performance'],['heat','heatSub','show-heatmap','weekly']]",
      "[['structure','structureSub','show-structure','signals'],['smart','smartSub','show-smart','performance']]",
    )
    .replace(
      "indicatorForm.append(...Object.values(groups));indicatorDialog",
      "indicatorForm.append(...Object.values(groups));const heatToggle=$('#show-heatmap');if(heatToggle){heatToggle.checked=false;groups.heat.hidden=true;$('#indicator-tab-heat').hidden=true;heatToggle.dispatchEvent(new Event('input',{bubbles:true}))}indicatorDialog",
    )
    .replace(
      "event.key==='Home'?0:event.key==='End'?2:(indicatorKeys.indexOf(selectedIndicator)+delta+3)%3",
      "event.key==='Home'?0:event.key==='End'?1:(indicatorKeys.indexOf(selectedIndicator)+delta+2)%2",
    )
    .replace(
      "['show-structure','show-smart','show-heatmap'].filter",
      "['show-structure','show-smart'].filter",
    );
}

async function customizeResponse(response, path) {
  if (path !== "/" && path !== "/index.html" && path !== "/portal.js") {
    return response;
  }

  let body = await response.text();
  if (path === "/" || path === "/index.html") {
    body = body.replace(
      '<input id="show-heatmap" type="checkbox" checked>',
      '<input id="show-heatmap" type="checkbox">',
    );
  } else {
    body = removeRegressionHeatmap(body);
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function handler(request) {
  const response = await worker.fetch(createWorkerRequest(request), {
    TWELVEDATA_API_KEY: process.env.TWELVEDATA_API_KEY,
  });
  return customizeResponse(response, requestedPath(request));
}
