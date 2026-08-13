const SERIALIZED_TOOLTIP_PREFIX = "gim-hub:";
export function serializeTooltip(tooltip) {
  return `${SERIALIZED_TOOLTIP_PREFIX}${JSON.stringify(tooltip)}`;
}
export function deserializeTooltip(tooltip) {
  if (!tooltip.startsWith(SERIALIZED_TOOLTIP_PREFIX)) return tooltip;
  return JSON.parse(tooltip.slice(SERIALIZED_TOOLTIP_PREFIX.length));
}
