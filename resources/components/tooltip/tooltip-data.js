import * as Member from "../../game/member";

const SERIALIZED_TOOLTIP_PREFIX = "gim-hub:";

export function itemBreakdownTooltip(name, itemID, owners, filter, memberStates) {
  return serializeTooltip({
    type: "item-breakdown",
    name,
    filter,
    owners: owners.map(function ownerStorage(owner) {
      return {
        ...owner,
        stashLocations: Member.stashItemLocations(memberStates.get(owner.name)?.stashUnits ?? new Map(), itemID),
        cargoHolds: Member.cargoHoldLocations(memberStates.get(owner.name)?.cargoHolds ?? new Map(), itemID),
      };
    }),
  });
}

export function serializeTooltip(tooltip) {
  return `${SERIALIZED_TOOLTIP_PREFIX}${JSON.stringify(tooltip)}`;
}
export function deserializeTooltip(tooltip) {
  if (!tooltip.startsWith(SERIALIZED_TOOLTIP_PREFIX)) {
    return tooltip;
  }

  return JSON.parse(tooltip.slice(SERIALIZED_TOOLTIP_PREFIX.length));
}
