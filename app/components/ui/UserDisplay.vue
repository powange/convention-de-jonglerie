<template>
  <div :class="containerClasses">
    <UiUserAvatar :user="user" :size="size" :border="border" :class="avatarClass" />
    <div :class="textContainerClasses">
      <p :class="pseudoClasses">
        {{ user.pseudo }}
      </p>
      <p v-if="datetime" :class="datetimeClasses" :title="formattedDateTime">
        {{ timeAgo }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface User {
  id?: number
  pseudo: string
  emailHash?: string
  profilePicture?: string | null
  updatedAt?: string
}

interface Props {
  user: User
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  border?: boolean
  avatarClass?: string
  layout?: 'horizontal' | 'vertical'
  datetime?: string | Date
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  border: false,
  avatarClass: '',
  layout: 'horizontal',
})

const { locale } = useI18n()

// Formatage des dates
const timeAgo = computed(() => {
  if (!props.datetime) return ''

  const date = typeof props.datetime === 'string' ? new Date(props.datetime) : props.datetime

  return useTimeAgoIntl(date, {
    locale: locale.value,
    relativeTimeFormatOptions: {
      numeric: 'auto',
      style: 'short',
    },
  }).value
})

const formattedDateTime = computed(() => {
  if (!props.datetime) return ''

  const date = typeof props.datetime === 'string' ? new Date(props.datetime) : props.datetime

  return date.toLocaleString(locale.value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

// Classes CSS calculées en fonction du layout
const containerClasses = computed(() => {
  const baseClasses = 'py-1'

  if (props.layout === 'vertical') {
    return `${baseClasses} flex flex-col items-center gap-2`
  }

  return `${baseClasses} flex items-center gap-3`
})

const textContainerClasses = computed(() => {
  if (props.layout === 'vertical') {
    return 'text-center'
  }

  return 'min-w-0 flex-1'
})

const pseudoClasses = computed(() => {
  const baseClasses = 'font-semibold text-gray-900 dark:text-white'

  if (props.layout === 'vertical') {
    return `${baseClasses} text-sm`
  }

  return `${baseClasses} truncate`
})

const datetimeClasses = computed(() => {
  const baseClasses = 'text-xs text-gray-500 dark:text-gray-400 cursor-help'

  if (props.layout === 'vertical') {
    return `${baseClasses} text-center`
  }

  return `${baseClasses} truncate`
})
</script>
