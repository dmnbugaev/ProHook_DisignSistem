<script setup lang="ts">
const props = defineProps<{
  label: string;
  tabs: { value: string; label: string }[];
}>();
const model = defineModel<string>({ required: true });
const id = useId();
const tablist = ref<HTMLElement>();
function navigate(event: KeyboardEvent, index: number) {
  let next: number;
  if (event.key === "ArrowRight") next = (index + 1) % props.tabs.length;
  else if (event.key === "ArrowLeft")
    next = (index - 1 + props.tabs.length) % props.tabs.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = props.tabs.length - 1;
  else return;
  event.preventDefault();
  model.value = props.tabs[next]!.value;
  tablist.value
    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    [next]?.focus();
}
</script>
<template>
  <div class="tabs">
    <div ref="tablist" class="tabs__list" role="tablist" :aria-label="label">
      <button
        v-for="(tab, index) in tabs"
        :id="`${id}-tab-${tab.value}`"
        :key="tab.value"
        role="tab"
        :aria-selected="model === tab.value"
        :aria-controls="`${id}-panel-${tab.value}`"
        :tabindex="model === tab.value ? 0 : -1"
        @click="model = tab.value"
        @keydown="navigate($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>
    <section
      v-for="tab in tabs"
      v-show="model === tab.value"
      :id="`${id}-panel-${tab.value}`"
      :key="tab.value"
      class="tabs__panel"
      role="tabpanel"
      :aria-labelledby="`${id}-tab-${tab.value}`"
      tabindex="0"
    >
      <slot :name="tab.value" />
    </section>
  </div>
</template>
