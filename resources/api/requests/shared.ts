import * as z from "zod/v4";
import * as DateFNS from "date-fns";

export const DateSchema = z.iso.datetime().transform((date) => DateFNS.parseISO(date));
