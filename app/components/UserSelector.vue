<template>
  <div class="flex gap-2">
    <USelectMenu
      :model-value="modelValue"
      :search-term="searchTerm"
      :items="searchedUsers"
      :loading="searchingUsers"
      searchable
      clearable
      :placeholder="placeholder"
      icon="i-heroicons-user"
      by="id"
      class="flex-1"
      @update:model-value="$emit('update:modelValue', $event)"
      @update:search-term="$emit('update:searchTerm', $event)"
    >
      <template #leading>
        <UAvatar
          v-if="modelValue?.avatar"
          :src="modelValue.avatar.src"
          :alt="modelValue.avatar.alt"
          size="xs"
        />
        <UIcon v-else name="i-heroicons-user-circle" class="text-gray-400 h-4 w-4" />
      </template>

      <template #item-leading="{ item }">
        <UAvatar v-if="item.avatar" :src="item.avatar.src" :alt="item.avatar.alt" size="xs" />
        <UIcon v-else name="i-heroicons-user-circle" class="text-gray-400 h-4 w-4" />
      </template>

      <template #empty>
        <div class="py-4 text-center text-xs text-gray-500">
          {{
            searchTerm.length < 2 ? 'Commencez à taper pour rechercher' : 'Aucun utilisateur trouvé'
          }}
        </div>
      </template>
    </USelectMenu>

    <UButton
      v-if="modelValue && showClearButton"
      variant="outline"
      color="neutral"
      size="sm"
      icon="i-heroicons-x-mark"
      class="shrink-0"
      @click="$emit('update:modelValue', null)"
    />
  </div>

  <!-- Suggestions rapides (optionnel) -->
  <div v-if="testUsers && testUsers.length > 0" class="mt-3">
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
      {{ testUsersLabel || 'Utilisateurs de test disponibles :' }}
    </p>
    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="user in testUsers"
        :key="user.id"
        variant="soft"
        size="sm"
        :color="modelValue?.id === user.id ? 'primary' : 'neutral'"
        class="transition-colors"
        @click="$emit('update:modelValue', user)"
      >
        <UAvatar
          v-if="user.avatar"
          :src="user.avatar.src"
          :alt="user.avatar.alt"
          size="xs"
          class="mr-1"
        />
        <UIcon v-else name="i-heroicons-user" class="mr-1 h-3 w-3" />
        {{ user.label.split(' ')[0] }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface UserSelectItem {
  id: number
  label: string
  email: string
  avatar?: { src: string; alt: string }
  isRealUser?: boolean
}

interface Props {
  modelValue: UserSelectItem | null
  searchTerm: string
  searchedUsers: UserSelectItem[]
  searchingUsers: boolean
  placeholder?: string
  showClearButton?: boolean
  testUsers?: UserSelectItem[]
  testUsersLabel?: string
}

withDefaults(defineProps<Props>(), {
  placeholder: 'Rechercher un utilisateur...',
  showClearButton: true,
  testUsers: undefined,
  testUsersLabel: undefined,
})

defineEmits<{
  'update:modelValue': [value: UserSelectItem | null]
  'update:searchTerm': [value: string]
}>()
</script>
