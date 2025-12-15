import { Fragment, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import * as Member from "../../game/member";

interface ItemsBreakdownTooltipProps {
  name: Member.Name;
  filter: Member.ItemContainer | "All";
  breakdown: Partial<Record<Member.ItemContainer, number>>;
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

  let content: ReactElement = <></>;
  if (tooltipData) {
    const lines = [];

    for (const itemContainer of Member.ItemContainer) {
      if (tooltipData.filter !== "All" && tooltipData.filter !== itemContainer) {
        continue;
      }

      const quantity = tooltipData.breakdown[itemContainer] ?? 0;

      if (tooltipData.filter === "All" && quantity === 0) {
        continue;
      }

      lines.push(
        <Fragment key={itemContainer}>
          <span>{itemContainer}</span> <span>{quantity.toLocaleString()}</span>
        </Fragment>,
      );
    }

    content = (
      <>
        {tooltipData.name}
        <br />
        <hr />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "1rem" }}>{lines}</div>
      </>
    );
  }

  const tooltipElement = createPortal(content, tooltipRef.current);

  return { tooltipElement, hideTooltip, showTooltip };
};
