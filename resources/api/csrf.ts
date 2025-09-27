export const getCsrfToken = (): string => {
  const metaTag = document.querySelector('meta[name="csrf-token"]');

  if (!metaTag) {
    throw new Error("CSRF token meta tag not found");
  }

  const content = metaTag.getAttribute("content");

  if (!content) {
    throw new Error("CSRF token content not found");
  }

  return content;
};
