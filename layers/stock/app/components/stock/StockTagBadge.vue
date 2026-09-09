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

const props = withDefaults(defineProps<{ tag: TagLike; size?: 'xs' | 'sm' | 'md' }>(), {
  size: 'md',
})

// `md` par défaut : les tailles reprises des tags de tâches se lisaient mal dans un tableau, où
// la pastille est l'information de la colonne et non une mention accessoire à côté d'un titre.
const TAILLES = {
  xs: 'px-1.5 py-0.5 text-[10px] leading-tight',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
} as const

const sizeClasses = computed(() => TAILLES[props.size])

// Même rendu que les tags de tâches : fond à 15 % d'opacité, texte à la couleur pleine. C'est le
// seul dosage qui reste lisible en clair comme en sombre.
const style = computed(() => {
  const color = /^#[0-9a-fA-F]{6}$/.test(props.tag.color) ? props.tag.color : '#64748b'
  return { backgroundColor: `${color}26`, color }
})
</script>
