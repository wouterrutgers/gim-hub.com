import * as z from "zod/v4";
import * as Member from "../../game/member";

export const MemberNameSchema = z
  .string("Member name is required.")
  .refine((name) => name === name.trim(), { error: "Member name cannot begin or end with spaces." })
  .refine((name) => !/[^A-Za-z 0-9-_]/g.test(name), {
    error: "Member name must use only characters 'A-Z', 'a-z', '0-9', and '-', '_', or ' '.",
  })
  .refine((name) => !/[ \-_]{2,}/g.test(name), {
    error: "Member name cannot contain more than 2 special characters '-', '_', or ' ' in a row.",
  })
  .refine((name) => name.length >= 1 && name.length <= 12, {
    error: ({ input }) => {
      if ((input as string).length === 0) return "Member name is required.";
      return "Member name must be between 1 and 12 characters.";
    },
  })
  .transform((name) => name.trim() as Member.Name);
