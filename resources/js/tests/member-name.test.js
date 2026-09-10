import { describe, expect, it } from "vite-plus/test";
import { memberNameSchema } from "../../game/member-name";

describe("memberNameSchema", function describeMemberNameSchema() {
  it("accepts a valid member name", function testValidMemberName() {
    expect(memberNameSchema.parse("Wise Old Man")).toBe("Wise Old Man");
  });

  it("rejects invalid characters and repeated separators", function testInvalidMemberName() {
    expect(memberNameSchema.safeParse("BadName!").success).toBe(false);
    expect(memberNameSchema.safeParse("Bad  Name").success).toBe(false);
  });
});
