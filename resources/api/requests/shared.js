import { parseISO } from "date-fns";
import * as z from "zod/v4";

export const dateSchema = z.iso.datetime().transform(function parseDate(date) {
  return parseISO(date);
});
