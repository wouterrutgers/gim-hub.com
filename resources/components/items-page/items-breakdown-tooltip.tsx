import { Fragment, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { ItemContainer } from "../../game/items";
import * as Member from "../../game/member";

interface ItemsBreakdownTooltipProps {
  name: Member.Name;
  filter: ItemContainer | "All";
  breakdown: Partial<Record<ItemContainer, number>>;
}

/**
 * When hovering over a player's item quantity, show a breakdown of which
 * containers contribute to the total.
 */
export const useItemsBreakdownTooltip = (): {
  tooltipElement: ReactElement;
  hideTooltip: () => void;
  showTooltip: (props: ItemsBreakdownTooltipProps) => void;
} => {
  const [tooltipData, setTooltipData] = useState<ItemsBreakdownTooltipProps>();
  const tooltipRef = useRef<HTMLElement>(document.getElementById("tooltip")!);

  const hideTooltip = (): void => {
    setTooltipData(undefined);
  };

  const showTooltip = (props: ItemsBreakdownTooltipProps): void => {
    setTooltipData(props);
  };

  const lines = [];

  if (tooltipData) {
    lines.push(
      <Fragment key={"header"}>
        {tooltipData.name}
        <hr />
      </Fragment>,
    );
    for (const itemContainer of ItemContainer) {
      if (tooltipData.filter !== "All" && tooltipData.filter !== itemContainer) {
        continue;
      }

      const quantity = tooltipData.breakdown[itemContainer] ?? 0;

      if (tooltipData.filter === "All" && quantity === 0) {
        continue;
      }

      lines.push(
        <Fragment key={itemContainer}>
          {itemContainer}: {quantity.toLocaleString()}
        </Fragment>,
      );
    }
  }

  const content: ReactElement = <>{lines}</>;

  const tooltipElement = createPortal(content, tooltipRef.current);

  return { tooltipElement, hideTooltip, showTooltip };
};
