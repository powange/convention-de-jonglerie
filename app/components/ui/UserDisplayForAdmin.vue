<template>
  <div class="flex items-center gap-3 py-1">
    <UiUserAvatar :user="user" :size="size" :border="border" :class="avatarClass" />
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <p class="font-semibold text-gray-900 dark:text-white truncate" :title="`ID: ${user.id}`">
          {{ user.pseudo }}
        </p>
        <slot name="badge" />
      </div>
      <p v-if="user.nom || user.prenom" class="text-sm text-gray-600 dark:text-gray-300 truncate">
        {{ `${user.prenom || ''} ${user.nom || ''}`.trim() }}
      </p>
      <p v-if="showEmail && user.email" class="text-sm text-gray-500 dark:text-gray-400 truncate">
        {{ user.email }}
      </p>
      <p v-if="showPhone && user.phone" class="text-sm text-gray-500 dark:text-gray-400 truncate">
        {{ user.phone }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface User {
  id: number
  pseudo: string
  nom?: string | null
  prenom?: string | null
  email?: string
  emailHash: string
  phone?: string | null
  profilePicture?: string | null
  updatedAt?: string
}

interface Props {
  user: User
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  border?: boolean
  showEmail?: boolean
  showPhone?: boolean
  avatarClass?: string
}

withDefaults(defineProps<Props>(), {
  size: 'lg',
  border: true,
  showEmail: true,
  showPhone: false,
  avatarClass: 'ring-2 ring-gray-200 dark:ring-gray-700',
})
</script>
