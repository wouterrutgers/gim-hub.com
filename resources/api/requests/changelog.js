import * as z from "zod/v4";

const changelogSchema = z.array(
  z.object({
    id: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().min(1),
    html: z.string(),
  }),
);

export async function fetchChangelog({ baseURL }) {
  const response = await fetch(`${baseURL}/changelog`);

  if (!response.ok) {
    throw new Error("Changelog HTTP response was not OK");
  }

  return changelogSchema.parseAsync(await response.json());
}
