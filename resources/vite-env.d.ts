/// <reference types="vite/client" />

declare module "*.html" {
  const src: string;
  export default src;
}

declare module "*.json" {
  const src: object;
  export default src;
}

declare module "@manifests/*" {
  const src: unknown;
  export default src;
}

// Vite global defines
declare const __API_URL__: string;
