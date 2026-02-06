<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
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
const NuxtLink = resolveComponent('NuxtLink')

interface Props {
  to?: string
  icon: string
  title: string
  description: string
  color?:
    | 'indigo'
    | 'blue'
    | 'green'
    | 'purple'
    | 'orange'
    | 'yellow'
    | 'gray'
    | 'warning'
    | 'error'
    | 'teal'
    | 'amber'
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
  const colorClasses: Record<string, string> = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30',
    blue: 'bg-blue-100 dark:bg-blue-900/30',
    green: 'bg-green-100 dark:bg-green-900/30',
    purple: 'bg-purple-100 dark:bg-purple-900/30',
    orange: 'bg-orange-100 dark:bg-orange-900/30',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30',
    gray: 'bg-gray-100 dark:bg-gray-900/30',
    warning: 'bg-amber-100 dark:bg-amber-900/30',
    error: 'bg-red-100 dark:bg-red-900/30',
    teal: 'bg-teal-100 dark:bg-teal-900/30',
    amber: 'bg-amber-100 dark:bg-amber-900/30',
  }

  return `p-2 rounded-lg ${colorClasses[props.color]}`
})

const iconClass = computed(() => {
  const colorClasses: Record<string, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    orange: 'text-orange-600 dark:text-orange-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    gray: 'text-gray-600 dark:text-gray-400',
    warning: 'text-amber-600 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
    teal: 'text-teal-600 dark:text-teal-400',
    amber: 'text-amber-600 dark:text-amber-400',
  }

  return `h-5 w-5 ${colorClasses[props.color]}`
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
