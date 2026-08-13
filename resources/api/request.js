import { getCsrfToken } from "./csrf";

export function request(url, options = {}) {
  const method = options.method?.toUpperCase() ?? "GET";

  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return fetch(url, options);
  }

  const headers = new Headers(options.headers);
  headers.set("X-CSRF-TOKEN", getCsrfToken());

  return fetch(url, { ...options, headers });
}
