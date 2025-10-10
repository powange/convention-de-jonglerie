<template>
  <BaseEmail :title="title" :base-url="baseUrl">
    <Text class="text-gray-700 mb-4">
      Bonjour <strong>{{ prenom }}</strong
      >,
    </Text>

    <Text class="text-gray-700 mb-4">
      Vos créneaux de bénévolat pour <strong>{{ conventionName }}</strong>
      {{ editionName !== conventionName ? `(${editionName})` : '' }} sont maintenant disponibles !
    </Text>

    <Section v-if="timeSlots && timeSlots.length > 0" class="mb-6">
      <Text class="text-gray-700 mb-3 font-semibold">📅 Vos créneaux :</Text>

      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-gray-300 px-4 py-2 text-left">Date</th>
            <th class="border border-gray-300 px-4 py-2 text-left">Créneau</th>
            <th class="border border-gray-300 px-4 py-2 text-left">Équipe</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(slot, index) in timeSlots" :key="index" class="border-b">
            <td class="border border-gray-300 px-4 py-2">
              {{ formatDate(slot.date) }}
            </td>
            <td class="border border-gray-300 px-4 py-2">
              {{ getTimeLabel(slot) }}
            </td>
            <td class="border border-gray-300 px-4 py-2">
              {{ slot.teamName }}
            </td>
          </tr>
        </tbody>
      </table>
    </Section>

    <Section v-else class="mb-6">
      <Text class="text-gray-700">
        Vos créneaux seront bientôt attribués. Consultez régulièrement votre espace bénévole pour
        rester informé.
      </Text>
    </Section>

    <Section :style="{ textAlign: 'center', marginBottom: '24px' }">
      <Button
        :href="actionUrl"
        :style="{
          display: 'inline-block',
          background: 'oklch(79.2% .209 151.711)',
          color: 'white',
          padding: '12px 30px',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          margin: '20px 0',
        }"
      >
        Voir mes créneaux
      </Button>
    </Section>

    <Text class="text-gray-600 text-sm mb-2">
      💡 <strong>Astuce :</strong> N'oubliez pas de consulter votre espace bénévole pour plus de
      détails sur vos missions et les consignes à suivre.
    </Text>

    <Text class="text-gray-600 text-sm">
      Si vous avez des questions ou besoin de modifications, contactez les organisateurs via la
      plateforme.
    </Text>
  </BaseEmail>
</template>

<script setup lang="ts">
import { Button, Section, Text } from '@vue-email/components'

import BaseEmail from './BaseEmail.vue'

interface TimeSlot {
  date: Date
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING'
  teamName: string
  startTime?: string
  endTime?: string
}

const props = defineProps<{
  prenom: string
  conventionName: string
  editionName: string
  timeSlots: TimeSlot[]
  actionUrl: string
  baseUrl: string
}>()

const title = `Vos créneaux de bénévolat - ${props.conventionName}`

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const getTimeLabel = (slot: TimeSlot) => {
  if (slot.startTime && slot.endTime) {
    return `${slot.startTime} - ${slot.endTime}`
  }
  const labels = {
    MORNING: '🌅 Matin',
    AFTERNOON: '☀️ Après-midi',
    EVENING: '🌙 Soir',
  }
  return labels[slot.timeOfDay] || slot.timeOfDay
}
</script>
