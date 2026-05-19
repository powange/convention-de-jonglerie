<template>
  <div v-if="text?.trim()" class="flex items-start gap-1 mt-0.5">
    <p
      ref="textRef"
      :class="expanded ? 'whitespace-pre-wrap' : 'truncate'"
      class="text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-0"
    >
      {{ text }}
    </p>
    <button
      v-if="isTruncated || expanded"
      type="button"
      class="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-0.5"
      :aria-label="expanded ? $t('common.show_less') : $t('common.show_more')"
      @click.stop="expanded = !expanded"
    >
      <UIcon
        :name="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        class="size-3.5"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ text: string | null }>()

const textRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
const isTruncated = ref(false)

function checkTruncation() {
  if (!textRef.value || expanded.value) return
  const el = textRef.value
  // Avec `truncate` (white-space: nowrap + overflow: hidden), scrollWidth
  // contient la largeur réelle du texte et clientWidth la largeur visible.
  isTruncated.value = el.scrollWidth > el.clientWidth + 1
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  checkTruncation()
  if (textRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => checkTruncation())
    resizeObserver.observe(textRef.value)
  }
})

watch(
  () => props.text,
  () => nextTick(checkTruncation)
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>
