<template>
  <div class="inline-flex items-center gap-0.5">
    <button
      v-for="star in 5"
      :key="star"
      type="button"
      :disabled="readonly"
      class="p-0.5 transition-colors"
      :class="readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'"
      @click="!readonly && emit('update:modelValue', star)"
      @mouseenter="!readonly && (hoveredStar = star)"
      @mouseleave="hoveredStar = 0"
    >
      <UIcon :name="getStarIcon(star)" class="size-6" :class="getStarColor(star)" />
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const hoveredStar = ref(0)

const activeStar = computed(() => hoveredStar.value || props.modelValue || 0)

function getStarIcon(star: number) {
  return star <= activeStar.value ? 'i-heroicons-star-solid' : 'i-heroicons-star'
}

function getStarColor(star: number) {
  if (star <= activeStar.value) {
    return 'text-yellow-400'
  }
  return 'text-gray-300 dark:text-gray-600'
}
</script>
