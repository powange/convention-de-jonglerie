<template>
  <NuxtLink :to="to" class="block">
    <UCard
      class="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div :class="iconContainerClass">
            <UIcon :name="icon" :class="iconClass" />
          </div>
          <div>
            <h3 class="font-medium">{{ title }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ description }}
            </p>
          </div>
        </div>
        <UIcon name="i-heroicons-arrow-right" class="h-4 w-4 text-gray-400" />
      </div>
    </UCard>
  </NuxtLink>
</template>

<script setup lang="ts">
interface Props {
  to: string
  icon: string
  title: string
  description: string
  color?: 'indigo' | 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'gray'
}

const props = withDefaults(defineProps<Props>(), {
  color: 'gray',
})

const iconContainerClass = computed(() => {
  const colorClasses = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30',
    blue: 'bg-blue-100 dark:bg-blue-900/30',
    green: 'bg-green-100 dark:bg-green-900/30',
    purple: 'bg-purple-100 dark:bg-purple-900/30',
    orange: 'bg-orange-100 dark:bg-orange-900/30',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30',
    gray: 'bg-gray-100 dark:bg-gray-900/30',
  }

  return `p-2 rounded-lg ${colorClasses[props.color]}`
})

const iconClass = computed(() => {
  const colorClasses = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    orange: 'text-orange-600 dark:text-orange-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    gray: 'text-gray-600 dark:text-gray-400',
  }

  return `h-5 w-5 ${colorClasses[props.color]}`
})
</script>
