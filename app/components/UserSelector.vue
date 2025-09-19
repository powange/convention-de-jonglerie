<template>
  <div class="flex gap-2">
    <USelectMenu
      v-model="internalValue"
      :search-term="searchTerm"
      :items="displayedItems"
      :loading="searchingUsers"
      ignore-filter
      option-attribute="label"
      :placeholder="placeholder"
      icon="i-heroicons-user"
      :ui="{ content: 'min-w-fit' }"
      class="flex-1"
      @update:search-term="(v) => emit('update:searchTerm', v)"
    >
      <template #leading>
        <UiUserAvatar
          v-if="internalValue"
          :user="{
            pseudo: internalValue.label.split(' — ')[0],
            profilePicture: internalValue.avatar?.src,
            emailHash: '',
          }"
          size="xs"
        />
        <UIcon v-else name="i-heroicons-user-circle" class="text-gray-400 h-4 w-4" />
      </template>

      <template #item-leading="{ item }">
        <UiUserAvatar
          :user="{
            pseudo: item.label.split(' — ')[0],
            profilePicture: item.avatar?.src,
            emailHash: '',
          }"
          size="xs"
        />
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
      v-if="internalValue && showClearButton"
      variant="outline"
      color="neutral"
      size="sm"
      icon="i-heroicons-x-mark"
      class="shrink-0"
      @click="internalValue = undefined"
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
        :color="internalValue?.id === user.id ? 'primary' : 'neutral'"
        class="transition-colors"
        @click="internalValue = user"
      >
        <UiUserAvatar
          :user="{
            pseudo: user.label.split(' — ')[0],
            profilePicture: user.avatar?.src,
            emailHash: '',
          }"
          size="xs"
          class="mr-1"
        />
        {{ user.label.split(' ')[0] }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, watch, computed } from 'vue'

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

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Rechercher un utilisateur...',
  showClearButton: true,
  testUsers: undefined,
  testUsersLabel: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: UserSelectItem | null]
  'update:searchTerm': [value: string]
}>()

// expose prop refs for template convenience
const {
  searchTerm,
  searchedUsers,
  searchingUsers,
  placeholder,
  showClearButton,
  testUsers,
  testUsersLabel,
} = toRefs(props)

// Prevent mutating the incoming prop directly: use an internal ref bound to the select
const internalValue = ref<UserSelectItem | undefined>(props.modelValue ?? undefined)

// Ensure items passed to USelectMenu include the email in the label so
// built-in filtering (which usually matches on label) also matches emails.
const itemsForSelect = computed(() => {
  const src = searchedUsers.value || []
  return src.map((u) => {
    // normalize possible fields returned by different endpoints
    const pseudo = (u as any).pseudo ?? (u as any).label ?? ''
    const email = (u as any).email ?? (u as any).emailAddress ?? ''
    const profilePicture = (u as any).profilePicture ?? (u as any).avatar?.src ?? undefined
    const avatar = profilePicture ? { src: profilePicture, alt: pseudo || '' } : undefined

    // Build a friendly label without introducing 'undefined' strings
    const baseLabel = pseudo || String((u as any).id || '')
    const fullLabel = email ? `${baseLabel} — ${email}` : baseLabel

    return {
      // preserve original properties (id, etc.) and expose expected fields
      id: (u as any).id,
      label: fullLabel,
      email,
      avatar,
      // keep other original data accessible if needed
      ...u,
    } as UserSelectItem & Record<string, any>
  })
})

// Ensure that an email search matches results: filter items by label or email
const displayedItems = computed(() => {
  const term = (searchTerm.value || '').trim().toLowerCase()
  // If the parent/API already returned results, trust them and show them as-is.
  if (searchedUsers.value && searchedUsers.value.length > 0) return itemsForSelect.value

  // Fallback to local filtering when we don't have server-side results
  if (!term || term.length < 2) return itemsForSelect.value
  return itemsForSelect.value.filter((u) => {
    const label = (u.label || '').toLowerCase()
    const email = (u.email || '').toLowerCase()
    return label.includes(term) || email.includes(term)
  })
})

watch(
  () => props.modelValue,
  (v) => {
    internalValue.value = v ?? undefined
  },
  { immediate: true }
)

watch(internalValue, (val) => {
  emit('update:modelValue', val ?? null)
})
</script>
<!-- thomas.devoue@example.com -->
