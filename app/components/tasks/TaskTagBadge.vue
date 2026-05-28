<template>
  <span :style="style" :class="['inline-flex items-center rounded-full font-medium', sizeClasses]">
    {{ tag.name }}
  </span>
</template>

<script setup lang="ts">
interface TagLike {
  name: string
  color: string
}

const props = withDefaults(
  defineProps<{
    tag: TagLike
    size?: 'xs' | 'sm'
  }>(),
  { size: 'xs' }
)

const sizeClasses = computed(() =>
  props.size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px] leading-tight'
)

// Badge clair : fond avec alpha 15% (#RRGGBB26) + texte avec la couleur d'origine.
// L'alpha 15% reste visible en mode clair comme en mode sombre.
const style = computed(() => {
  const color = /^#[0-9a-fA-F]{6}$/.test(props.tag.color) ? props.tag.color : '#64748b'
  return {
    backgroundColor: `${color}26`,
    color,
  }
})
</script>
