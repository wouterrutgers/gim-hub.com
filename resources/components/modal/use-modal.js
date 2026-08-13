import { ref, shallowRef } from "vue";

export function useModal() {
  const open = ref(false);
  const componentProps = shallowRef({});

  function openModal(props = {}) {
    componentProps.value = { ...props };
    open.value = true;
  }

  function closeModal() {
    open.value = false;
    componentProps.value = {};
  }

  return { open, componentProps, openModal, closeModal };
}
