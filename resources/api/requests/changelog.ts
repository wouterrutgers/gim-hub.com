import * as z from "zod/v4";

export interface ChangelogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  html: string;
}

export type Response = z.infer<typeof Schema>;

export const fetchChangelog = ({ baseURL }: { baseURL: string }): Promise<Response> => {
  return fetch(`${baseURL}/changelog`)
    .then((response) => response.json())
    .then((json) => Schema.safeParseAsync(json))
    .then((parseResult) => {
      if (!parseResult.success) throw new Error("Failed to parse changelog response", { cause: parseResult.error });
      return parseResult.data;
    });
};

export const Schema = z.array(
  z.object({
    id: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().min(1),
    html: z.string(),
  }),
);
