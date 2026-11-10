// @vitest-environment jsdom

import { h, nextTick, ref } from "vue";
import { expect, it } from "vite-plus/test";
import { createTestApplication } from "./vue-test-helpers";
import Modal from "../../components/modal/Modal.vue";

it("keeps keyboard focus in an open dialog and returns to its opener on Escape", async function dialogFocus() {
  const open = ref(false);
  const content = {
    render() {
      return h("section", { role: "dialog", "aria-modal": "true" }, [h("button", "First"), h("button", "Last")]);
    },
  };
  const application = createTestApplication({
    render() {
      return [
        h(
          "button",
          {
            onClick: function openDialog() {
              open.value = true;
            },
          },
          "Open",
        ),
        h(Modal, {
          open: open.value,
          component: content,
          onClose: function closeDialog() {
            open.value = false;
          },
        }),
      ];
    },
  });
  const container = document.createElement("div");
  document.body.append(container);
  application.mount(container);
  const opener = container.querySelector("button");
  opener.focus();
  opener.click();
  await nextTick();
  await nextTick();
  const [first, last] = document.querySelectorAll('[role="dialog"] button');
  expect(document.activeElement).toBe(first);
  expect(container.inert).toBe(true);

  first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(last);
  last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(first);
  first.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await nextTick();

  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(opener);
  expect(container.inert).toBe(false);
});
