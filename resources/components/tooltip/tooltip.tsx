import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import * as Member from "../../game/member";
import { PlayerIcon } from "../player-icon/player-icon";
import { StatBar } from "../player-panel/stat-bar";
import { deserializeTooltip, type ItemTooltipData, type TooltipData } from "./tooltip-data";

import "./tooltip.css";

function ItemTooltipContent({ tooltip }: { tooltip: ItemTooltipData }): ReactElement {
  const lines: ({ key: string; value: string; type?: undefined } | { key: string; type: "separator" })[] = [];

  if (tooltip.type === "item") {
    lines.push({
      key: "name",
      value: tooltip.quantity > 1 ? `${tooltip.name} x ${tooltip.quantity.toLocaleString()}` : tooltip.name,
    });

    if (tooltip.highAlch > 0 || tooltip.gePrice > 0) {
      lines.push({ key: "after-name", type: "separator" });
    }

    if (tooltip.highAlch > 0) {
      const unitPrice = tooltip.highAlch.toLocaleString();
      const totalPrice = (tooltip.highAlch * tooltip.quantity).toLocaleString();
      lines.push({
        key: "high-alch",
        value: tooltip.quantity > 1 ? `HA: ${totalPrice}gp (${unitPrice}gp each)` : `HA: ${unitPrice}gp`,
      });
    }

    if (tooltip.gePrice > 0) {
      const unitPrice = tooltip.gePrice.toLocaleString();
      const totalPrice = (tooltip.gePrice * tooltip.quantity).toLocaleString();
      lines.push({
        key: "grand-exchange",
        value: tooltip.quantity > 1 ? `GE: ${totalPrice}gp (${unitPrice}gp each)` : `GE: ${unitPrice}gp`,
      });
    }
  } else {
    lines.push({ key: "name", value: tooltip.name });
    lines.push({ key: "after-name", type: "separator" });
    lines.push({ key: "high-alch", value: `HA total: ${tooltip.totalHighAlch.toLocaleString()}gp` });
    lines.push({ key: "grand-exchange", value: `GE total: ${tooltip.totalGePrice.toLocaleString()}gp` });
    lines.push({ key: "after-prices", type: "separator" });

    for (const { name, quantity } of tooltip.runes) {
      lines.push({ key: `rune ${name} ${quantity}`, value: `${quantity.toLocaleString()} ${name}` });
    }
  }

  let skipBreak = false;

  return (
    <>
      {lines.map((line, index) => {
        if (line.type === "separator") {
          skipBreak = true;
          return <hr key={line.key} />;
        }

        const addBreak = index > 0 && !skipBreak;
        skipBreak = false;

        return (
          <Fragment key={line.key}>
            {addBreak ? <br /> : undefined}
            {line.value}
          </Fragment>
        );
      })}
    </>
  );
}

function TooltipContent({ tooltip }: { tooltip: string | TooltipData }): ReactElement {
  if (typeof tooltip === "string") {
    return <>{tooltip}</>;
  }

  if (tooltip.type === "item" || tooltip.type === "rune-pouch") {
    return <ItemTooltipContent tooltip={tooltip} />;
  }

  if (tooltip.type === "skill-total") {
    return <>Total XP: {tooltip.experience.toLocaleString()}</>;
  }

  if (tooltip.type === "skill-individual") {
    return (
      <>
        Level: {tooltip.level.toLocaleString()}
        <br />
        Total XP: {tooltip.experience.toLocaleString()}
        <br />
        Until level: {tooltip.untilNext.toLocaleString()}
        <StatBar
          color={`hsl(${107 * tooltip.untilNextRatio}, 100%, 41%)`}
          bgColor="#222222"
          ratio={tooltip.untilNextRatio}
        />
        Until max: {tooltip.untilMax.toLocaleString()}
        <StatBar
          color={`hsl(${107 * tooltip.untilMaxRatio}, 100%, 41%)`}
          bgColor="#222222"
          ratio={tooltip.untilMaxRatio}
        />
      </>
    );
  }

  if (tooltip.type === "item-price") {
    return (
      <>
        {tooltip.perPiecePrice.toLocaleString()}gp × {tooltip.quantity.toLocaleString()}
      </>
    );
  }

  if (tooltip.type === "item-breakdown") {
    return (
      <>
        {tooltip.name}
        <br />
        <hr />
        <div className="tooltip-item-breakdown">
          {Member.ItemContainer.map((itemContainer) => {
            if (tooltip.filter !== "All" && tooltip.filter !== itemContainer) return undefined;

            const quantity = tooltip.breakdown[itemContainer] ?? 0;
            if (tooltip.filter === "All" && quantity === 0) return undefined;

            return (
              <Fragment key={itemContainer}>
                <span>{itemContainer}</span>
                <span>{quantity.toLocaleString()}</span>
              </Fragment>
            );
          })}
        </div>
      </>
    );
  }

  if (tooltip.type === "collection-log-item") {
    return (
      <>
        {tooltip.name}
        {tooltip.memberQuantities.map(({ name, quantity }) => (
          <Fragment key={name}>
            <br /> <PlayerIcon name={name} />
            {name}: {quantity}
          </Fragment>
        ))}
      </>
    );
  }

  if (tooltip.type === "local-time") {
    return (
      <>
        Local time for {tooltip.name}
        <br />
        Timezone: {tooltip.timezone}
      </>
    );
  }

  throw new Error(`Unsupported tooltip type: ${(tooltip as { type: string }).type}`);
}

export const Tooltip = (): ReactElement => {
  const elementRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pointerPositionRef = useRef({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<string | TooltipData>();

  const positionTooltip = useCallback((): void => {
    if (!elementRef.current || !tooltipRef.current?.hasChildNodes()) return;

    const { x, y } = pointerPositionRef.current;
    elementRef.current.style.transform = `translate(${x}px, ${y}px)`;

    const rect = tooltipRef.current.getBoundingClientRect();
    const offsetX = x + 5 + rect.width > window.innerWidth ? -(rect.width + 5) : 5;
    const offsetY = y - rect.height - 5 < 0 ? 5 : -(rect.height + 5);

    tooltipRef.current.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  }, []);

  useLayoutEffect(() => {
    positionTooltip();
  }, [positionTooltip, tooltip]);

  useEffect(() => {
    function getDataTooltipElement(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;

      return target.closest<HTMLElement>("[data-tooltip]");
    }

    function handlePointerMove({ clientX: x, clientY: y }: PointerEvent): void {
      pointerPositionRef.current = { x, y };
      positionTooltip();
    }

    function handlePointerOver(event: PointerEvent): void {
      const tooltipElement = getDataTooltipElement(event.target);
      if (!tooltipElement) return;

      pointerPositionRef.current = { x: event.clientX, y: event.clientY };
      setTooltip(deserializeTooltip(tooltipElement.dataset.tooltip ?? ""));
    }

    function handlePointerOut(event: PointerEvent): void {
      if (getDataTooltipElement(event.target) === getDataTooltipElement(event.relatedTarget)) return;

      setTooltip(undefined);
    }

    function handlePointerDown(): void {
      setTooltip(undefined);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerover", handlePointerOver);
    window.addEventListener("pointerout", handlePointerOut);
    window.addEventListener("pointerdown", handlePointerDown);

    return (): void => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerover", handlePointerOver);
      window.removeEventListener("pointerout", handlePointerOut);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div id="tooltip-container" ref={elementRef}>
      <div id="tooltip" ref={tooltipRef} role="tooltip">
        {tooltip === undefined ? undefined : <TooltipContent tooltip={tooltip} />}
      </div>
    </div>
  );
};
