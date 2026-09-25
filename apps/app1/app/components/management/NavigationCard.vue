<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    data-carte-gestion
    class="block w-full text-left"
    @click="handleClick"
  >
    <UCard
      class="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div :class="iconContainerClass">
            <UIcon :name="icon" :class="iconClass" />
          </div>
          <div>
            <h3 :class="['font-medium', titleClass]">{{ title }}</h3>
            <p :class="['text-sm', descriptionClass]">
              {{ description }}
            </p>
          </div>
        </div>
        <UIcon name="i-heroicons-arrow-right" class="h-4 w-4 text-gray-400" />
      </div>
    </UCard>
  </component>
</template>

<script setup lang="ts">
import { FOND_DE_MODULE, ICONE_DE_MODULE, type CouleurDeModule } from '~/utils/couleurs-de-module'

const NuxtLink = resolveComponent('NuxtLink')

interface Props {
  to?: string
  icon: string
  title: string
  description: string
  color?: CouleurDeModule
}

const props = withDefaults(defineProps<Props>(), {
  to: undefined,
  color: 'gray',
})

const emit = defineEmits<{
  click: []
}>()

const handleClick = () => {
  if (!props.to) {
    emit('click')
  }
}

const iconContainerClass = computed(() => {
  return `p-2 rounded-lg ${FOND_DE_MODULE[props.color]}`
})

const iconClass = computed(() => {
  return `h-5 w-5 ${ICONE_DE_MODULE[props.color]}`
})

const titleClass = computed(() => {
  if (props.color === 'error') return 'text-red-600 dark:text-red-400'
  return ''
})

const descriptionClass = computed(() => {
  if (props.color === 'error') return 'text-red-500/70 dark:text-red-400/70'
  return 'text-gray-600 dark:text-gray-400'
})
</script>
