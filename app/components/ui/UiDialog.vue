<script setup lang="ts">
const props = withDefaults(
  defineProps<{ title: string; menu?: boolean; dismissible?: boolean }>(),
  { dismissible: true },
);
const open = defineModel<boolean>({ default: false });
const element = ref<HTMLDialogElement>();
const id = useId();
let previousOverflow = "";
let initiator: HTMLElement | null = null;
let locked = false;
function unlock() {
  if (!locked) return;
  document.body.style.overflow = previousOverflow;
  locked = false;
}
function sync() {
  const dialog = element.value;
  if (!dialog) return;
  if (open.value && !dialog.open) {
    initiator =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    locked = true;
    dialog.showModal();
  } else if (!open.value && dialog.open) {
    dialog.close();
    unlock();
    initiator?.focus({ preventScroll: true });
  }
}
watch(open, sync, { flush: "post" });
onMounted(sync);
onBeforeUnmount(unlock);
function close() {
  if (!props.dismissible) return;
  open.value = false;
}
function closed() {
  open.value = false;
  unlock();
}
function trapFocus(event: KeyboardEvent) {
  if (event.key !== "Tab" || !element.value) return;
  const candidates = Array.from(
    element.value.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.getClientRects().length > 0 && el.tabIndex >= 0);
  const first = candidates[0];
  const last = candidates.at(-1);
  if (!first || !last) {
    event.preventDefault();
    element.value.focus();
    return;
  }
  // Safari's system keyboard preference can skip buttons; own the full cycle.
  event.preventDefault();
  const index = candidates.indexOf(document.activeElement as HTMLElement);
  const next =
    index < 0
      ? event.shiftKey
        ? candidates.length - 1
        : 0
      : (index + (event.shiftKey ? -1 : 1) + candidates.length) %
        candidates.length;
  candidates[next]?.focus();
}
</script>
<template>
  <dialog
    ref="element"
    class="dialog"
    :class="{ 'dialog--menu': menu }"
    :aria-labelledby="`${id}-title`"
    @keydown="trapFocus"
    @cancel.prevent="close"
    @close="closed"
    @click="$event.target === element && close()"
  >
    <div class="dialog__content">
      <div class="dialog__header">
        <h2 :id="`${id}-title`">{{ title }}</h2>
        <UiIconButton
          v-if="dismissible"
          label="Закрыть"
          autofocus
          @click="close"
        >
          <span aria-hidden="true">×</span>
        </UiIconButton>
      </div>
      <slot :close="close" />
    </div>
  </dialog>
</template>
