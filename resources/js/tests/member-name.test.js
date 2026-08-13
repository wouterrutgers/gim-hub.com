import { describe, expect, it } from "vite-plus/test";
import { memberNameSchema } from "../../game/member-name";

describe("memberNameSchema", function describeMemberNameSchema() {
  it("accepts a valid member name", function testValidMemberName() {
    expect(memberNameSchema.parse("Wise Old Man")).toBe("Wise Old Man");
  });

  it("returns the established validation messages", function testInvalidMemberName() {
    const result = memberNameSchema.safeParse("Bad  Name!");

    expect(result.success).toBe(false);
    expect(
      result.error.issues.map(function getMessage(issue) {
        return issue.message;
      }),
    ).toEqual([
      "Member name must use only characters 'A-Z', 'a-z', '0-9', and '-', '_', or ' '.",
      "Member name cannot contain more than 2 special characters '-', '_', or ' ' in a row.",
    ]);
  });
});
