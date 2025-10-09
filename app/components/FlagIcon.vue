<template>
  <span :class="flagClass" class="flag-icon" :title="normalized || props.code || ''" />
</template>

<script setup lang="ts">
const props = defineProps<{
  code: string | null | undefined
}>()

// Normalise: garde les deux premières lettres, lowercase
const normalized = computed(() => (props.code ? props.code.slice(0, 2).toLowerCase() : ''))
const flagClass = computed(() => (normalized.value ? `fi fi-${normalized.value}` : 'fi'))
</script>

<style scoped>
.flag-icon {
  width: 1.1rem;
  height: 0.8rem;
  display: inline-block;
  background-size: contain;
  background-position: 50%;
  background-repeat: no-repeat;
  border-radius: 2px;
}
</style>
