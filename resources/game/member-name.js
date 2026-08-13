import * as z from "zod/v4";

export const memberNameSchema = z
  .string("Member name is required.")
  .refine(
    function hasNoOuterSpaces(name) {
      return name === name.trim();
    },
    { error: "Member name cannot begin or end with spaces." },
  )
  .refine(
    function hasAllowedCharacters(name) {
      return !/[^A-Za-z 0-9-_]/g.test(name);
    },
    { error: "Member name must use only characters 'A-Z', 'a-z', '0-9', and '-', '_', or ' '." },
  )
  .refine(
    function hasNoRepeatedSeparators(name) {
      return !/[ \-_]{2,}/g.test(name);
    },
    { error: "Member name cannot contain more than 2 special characters '-', '_', or ' ' in a row." },
  )
  .refine(
    function hasValidLength(name) {
      return name.length >= 1 && name.length <= 12;
    },
    {
      error({ input }) {
        return input.length === 0 ? "Member name is required." : "Member name must be between 1 and 12 characters.";
      },
    },
  )
  .transform(function trimMemberName(name) {
    return name.trim();
  });
