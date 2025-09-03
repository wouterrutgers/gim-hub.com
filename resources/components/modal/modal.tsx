import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

import "./modal.css";

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * A modal that attaches itself to the body DOM node, which is "root" in this
 * app. Having multiple of these modals open at once will probably cause issues,
 * it is untested. This hook handles focus, adds blurring, adds a clickable
 * background, and more. All calling code needs is to supply a child component,
 * and call the returned `open` function.
 *
 * @param Children - Component to render as a child of the global modal DOM
 *    node. One of its props may be a callback that closes the modal, named
 *    `onCloseModal`, which is supplied by this hook.
 * @returns
 *  - `open`: A function that opens the modal, taking the Child's props as an
 *    argument EXCEPT for `onCloseModal`.
 *  - `close`: A function that closes the modal.
 *  - `modal`: The modal element that needs to be rendered. Should just be
 *    unconditionally rendered, since it will be `undefined` if not open.
 */
export const useModal = <TProps extends { onCloseModal: () => void }>(
  Child: (props: TProps) => ReactNode,
): { open: (props: Prettify<Omit<TProps, "onCloseModal">>) => void; close: () => void; modal?: ReactElement } => {
  /*
   * Children and otherProps are passed separately to assist with
   * reconciliation. Children can be a stable, constant functional component.
   * otherProps can be spread, and all its members can be stable.
   *
   * If we tried to combine the two parameters, it would almost certainly lead to permanent
   * remounting, which I did encounter while prototyping this.
   */

  const [props, setProps] = useState<Omit<TProps, "onCloseModal">>();

  // We toggle inert on the rest of the DOM so that only our modal can be interacted with.
  const close = useCallback(() => {
    setProps(undefined);
    document.body.querySelectorAll<HTMLElement>(":not(#modal)").forEach((el) => el.removeAttribute("inert"));
  }, []);
  const open = useCallback((props: Omit<TProps, "onCloseModal">) => {
    document.body.querySelectorAll<HTMLElement>(":not(#modal)").forEach((el) => (el.inert = true));
    setProps({ ...props });
  }, []);

  useEffect(() => {
    const closeOnEsc = (e: KeyboardEvent): void => {
      if (e.key === "Escape" || e.key === "Esc") {
        close();
      }
    };
    window.addEventListener("keydown", closeOnEsc);
    return (): void => window.removeEventListener("keydown", closeOnEsc);
  }, [close]);

  useEffect(() => {
    if (!props) return;

    /*
     * I don't really know why, but even if we .blur() the activeElement, inert
     * elements in the background still get keyboard events. However, if we
     * .focus() then .blur() an interactive element from the new interactive
     * modal, the background stops getting keyboard events. So we do that, even
     * if it is kinda hacky. I don't know what else to do right now.
     *
     * I noticed the behavior on Chrome and Firefox.
     *
     * TODO: Figure out why focus + blur is needed for modal.
     */
    const focusableElements = document.querySelectorAll(
      '#modal button, #modal [href], #modal input, #modal select, #modal textarea, #modal [tabindex]:not([tabindex="-1"])',
    );
    if (focusableElements.length > 0) {
      const firstFocusable = focusableElements[0] as Partial<HTMLElement>;
      firstFocusable.focus?.();
      firstFocusable.blur?.();
    }
  }, [props]);

  let modal = undefined;
  if (props) {
    // I don't know how to design the generics to avoid needing the 'as'.
    const unifiedProps = { ...props, onCloseModal: close } as TProps;

    modal = (
      <>
        <button id="modal-clickbox" onClick={close} aria-label="Exit modal" />
        <div id="modal">
          <Child {...unifiedProps} />
        </div>
      </>
    );
  }
  return { open, close, modal: createPortal(modal, document.body) };
};
