import type { Experience } from "../../game/skill";
import type * as Member from "../../game/member";

export type ItemTooltipData =
  | {
      type: "item";
      name: string;
      quantity: number;
      highAlch: number;
      gePrice: number;
    }
  | {
      type: "rune-pouch";
      name: string;
      totalHighAlch: number;
      totalGePrice: number;
      runes: { name: string; quantity: number }[];
    };

export type TooltipData =
  | ItemTooltipData
  | {
      type: "skill-total";
      experience: Experience;
    }
  | {
      type: "skill-individual";
      level: number;
      experience: Experience;
      untilNextRatio: number;
      untilNext: Experience;
      untilMaxRatio: number;
      untilMax: Experience;
    }
  | {
      type: "item-price";
      perPiecePrice: number;
      quantity: number;
    }
  | {
      type: "item-breakdown";
      name: Member.Name;
      filter: Member.ItemContainer | "All";
      breakdown: Partial<Record<Member.ItemContainer, number>>;
    }
  | {
      type: "collection-log-item";
      name: string;
      memberQuantities: { name: Member.Name; quantity: number }[];
    }
  | {
      type: "local-time";
      name: Member.Name;
      timezone: string;
    };

const SERIALIZED_TOOLTIP_PREFIX = "gim-hub:";

export function serializeTooltip(tooltip: TooltipData): string {
  return `${SERIALIZED_TOOLTIP_PREFIX}${JSON.stringify(tooltip)}`;
}

export function deserializeTooltip(tooltip: string): string | TooltipData {
  if (!tooltip.startsWith(SERIALIZED_TOOLTIP_PREFIX)) return tooltip;

  return JSON.parse(tooltip.slice(SERIALIZED_TOOLTIP_PREFIX.length)) as TooltipData;
}
