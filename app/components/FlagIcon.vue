<template>
  <span :class="`fi fi-${code}`" class="flag-icon" />
</template>

<script setup lang="ts">
defineProps<{
  code: string
}>()
</script>

<style scoped>
.flag-icon {
  width: 1.25rem;
  height: 0.938rem;
  display: inline-block;
  background-size: contain;
  background-position: 50%;
  background-repeat: no-repeat;
  border-radius: 2px;
}
</style>
