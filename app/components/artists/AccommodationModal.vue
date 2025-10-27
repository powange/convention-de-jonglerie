<template>
  <UModal v-model:open="isOpen" title="Proposition d'hébergement" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div class="space-y-4">
        <div class="flex items-start gap-3">
          <UIcon name="i-heroicons-user" class="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <div class="text-sm font-medium text-gray-900 dark:text-white">
              {{ artistName }}
            </div>
          </div>
        </div>

        <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {{ accommodationProposal }}
          </p>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" @click="close"> Fermer </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  artist: any
  accommodationProposal: string
}>()

const isOpen = defineModel<boolean>({ required: true })

const artistName = computed(() => {
  if (!props.artist?.user) return ''
  return `${props.artist.user.prenom} ${props.artist.user.nom}`
})
</script>
