import { getCsrfToken } from "./csrf";

const originalFetch = window.fetch;

window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const needsCsrf = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  if (needsCsrf) {
    const csrfToken = getCsrfToken();

    if (csrfToken) {
      const headers = new Headers(init?.headers);
      headers.set("X-CSRF-TOKEN", csrfToken);

      init = {
        ...init,
        headers,
      };
    }
  }

  return originalFetch.call(this, input, init);
};
