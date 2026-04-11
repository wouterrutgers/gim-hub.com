export const GroupMode = ["Normal", "Leagues"] as const;

export type GroupMode = (typeof GroupMode)[number];

export const toGroupModeQueryValue = (groupMode: GroupMode): string => {
  return groupMode === "Leagues" ? "leagues" : "normal";
};
