<template>
  <UCard
    variant="outline"
    :ui="{
      header: headerBgClass,
      body: 'space-y-4',
    }"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          :class="iconBgClass"
        >
          <UIcon :name="icon" class="size-5" :class="iconColorClass" />
        </div>
        <h2 class="text-lg font-semibold">{{ title }}</h2>
      </div>
    </template>

    <slot />
  </UCard>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    icon: string
    title: string
    color?: 'blue' | 'amber' | 'green' | 'purple'
  }>(),
  {
    color: 'green',
  },
)

const colorMap = {
  blue: {
    headerBg: 'bg-blue-50/50 dark:bg-blue-950/20',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    headerBg: 'bg-amber-50/50 dark:bg-amber-950/20',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  green: {
    headerBg: 'bg-green-50/50 dark:bg-green-950/20',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  purple: {
    headerBg: 'bg-purple-50/50 dark:bg-purple-950/20',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
}

const headerBgClass = computed(() => colorMap[props.color].headerBg)
const iconBgClass = computed(() => colorMap[props.color].iconBg)
const iconColorClass = computed(() => colorMap[props.color].iconColor)
</script>
