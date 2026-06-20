<template>
  <div v-if="users.length > 0" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
    <div class="flex items-center gap-2">
      <!-- Affichage des avatars si moins de 3 utilisateurs -->
      <div v-if="users.length <= 3" class="flex -space-x-2">
        <UiUserAvatar
          v-for="user in users"
          :key="user.id"
          :user="user"
          size="xs"
          class="ring-2 ring-white dark:ring-gray-900"
        />
      </div>

      <!-- Message de typing -->
      <div class="flex items-center gap-1">
        <span>{{ typingMessage }}</span>
        <!-- Animation de points (style Nuxt UI ChatMessages) -->
        <div class="flex items-center gap-1">
          <div
            class="size-1.5 rounded-full bg-gray-500 dark:bg-gray-400 animate-[bounce_1s_infinite]"
          ></div>
          <div
            class="size-1.5 rounded-full bg-gray-500 dark:bg-gray-400 animate-[bounce_1s_0.15s_infinite]"
          ></div>
          <div
            class="size-1.5 rounded-full bg-gray-500 dark:bg-gray-400 animate-[bounce_1s_0.3s_infinite]"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface User {
  id: number
  pseudo: string
  profilePicture?: string | null
}

const props = defineProps<{
  users: User[]
}>()

const typingMessage = computed(() => {
  const count = props.users.length

  if (count === 0) return ''
  if (count === 1) return `${props.users[0].pseudo} est en train d'écrire`
  if (count === 2)
    return `${props.users[0].pseudo} et ${props.users[1].pseudo} sont en train d'écrire`
  if (count === 3)
    return `${props.users[0].pseudo}, ${props.users[1].pseudo} et ${props.users[2].pseudo} sont en train d'écrire`

  return `${count} personnes sont en train d'écrire`
})
</script>
