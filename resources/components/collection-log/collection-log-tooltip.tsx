import { Fragment, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { PlayerIcon } from "../player-icon/player-icon";
import type * as Member from "../../game/member";

export interface CollectionLogItemTooltipProps {
  name: string;
  memberQuantities: { name: Member.Name; quantity: number }[];
}

export const useCollectionLogItemTooltip = (): {
  tooltipElement: ReactElement;
  hideTooltip: () => void;
  showTooltip: (props: CollectionLogItemTooltipProps) => void;
} => {
  const [props, setProps] = useState<CollectionLogItemTooltipProps>();
  const tooltipRef = useRef<HTMLDivElement>(document.body.querySelector<HTMLDivElement>("div#tooltip")!);

  const hideTooltip = (): void => {
    setProps(undefined);
    tooltipRef.current.style.visibility = "hidden";
  };
  const showTooltip = (item: CollectionLogItemTooltipProps): void => {
    setProps(item);
    tooltipRef.current.style.visibility = "visible";
  };

  const content = (
    <>
      {props?.name}
      {props?.memberQuantities.map(({ name, quantity }) => (
        <Fragment key={name}>
          <br /> <PlayerIcon name={name} />
          {name}: {quantity}
        </Fragment>
      ))}
    </>
  );

  const tooltipElement = createPortal(content, tooltipRef.current);

  return { tooltipElement, hideTooltip, showTooltip };
};
