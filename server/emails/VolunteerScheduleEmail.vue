<template>
  <BaseEmail :title="title" :base-url="baseUrl" :preheader="preheaderText">
    <Text :style="{ color: '#374151', margin: '0 0 16px' }">
      Bonjour <strong>{{ prenom }}</strong
      >,
    </Text>

    <Text :style="{ color: '#374151', margin: '0 0 20px' }">
      Vos cr&#233;neaux de b&#233;n&#233;volat pour <strong>{{ conventionName }}</strong>
      {{ editionName !== conventionName ? `(${editionName})` : '' }} sont maintenant disponibles !
    </Text>

    <Section v-if="timeSlots && timeSlots.length > 0" :style="{ margin: '0 0 24px' }">
      <Text :style="{ color: '#374151', fontWeight: '600', margin: '0 0 12px' }">
        Vos cr&#233;neaux :
      </Text>

      <table
        :style="{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
        }"
      >
        <thead>
          <tr>
            <th
              :style="{
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                padding: '10px 12px',
                textAlign: 'left',
                color: '#374151',
                fontWeight: '600',
              }"
            >
              Date
            </th>
            <th
              :style="{
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                padding: '10px 12px',
                textAlign: 'left',
                color: '#374151',
                fontWeight: '600',
              }"
            >
              Cr&#233;neau
            </th>
            <th
              :style="{
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                padding: '10px 12px',
                textAlign: 'left',
                color: '#374151',
                fontWeight: '600',
              }"
            >
              &#201;quipe
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(slot, index) in timeSlots" :key="index">
            <td :style="{ border: '1px solid #e5e7eb', padding: '10px 12px', color: '#374151' }">
              {{ formatDate(slot.date) }}
            </td>
            <td :style="{ border: '1px solid #e5e7eb', padding: '10px 12px', color: '#374151' }">
              {{ getTimeLabel(slot) }}
            </td>
            <td :style="{ border: '1px solid #e5e7eb', padding: '10px 12px', color: '#374151' }">
              {{ slot.teamName }}
            </td>
          </tr>
        </tbody>
      </table>
    </Section>

    <Section v-else :style="{ margin: '0 0 24px' }">
      <Text :style="{ color: '#6b7280', fontSize: '14px' }">
        Vos cr&#233;neaux seront bient&#244;t attribu&#233;s. Consultez r&#233;guli&#232;rement
        votre espace b&#233;n&#233;vole pour rester inform&#233;.
      </Text>
    </Section>

    <Section :style="{ textAlign: 'center', margin: '0 0 24px' }">
      <Button
        :href="actionUrl"
        :style="{
          display: 'inline-block',
          backgroundColor: '#10b981',
          color: '#ffffff',
          padding: '12px 32px',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: '600',
          fontSize: '14px',
        }"
      >
        Voir mes cr&#233;neaux
      </Button>
    </Section>

    <Section
      :style="{
        backgroundColor: '#f0fdf4',
        padding: '12px 16px',
        borderRadius: '6px',
        margin: '0 0 20px',
      }"
    >
      <Text :style="{ color: '#166534', fontSize: '13px', margin: '0' }">
        <strong>Astuce :</strong> Consultez votre espace b&#233;n&#233;vole pour plus de
        d&#233;tails sur vos missions et les consignes &#224; suivre.
      </Text>
    </Section>

    <Hr :style="{ borderColor: '#e5e7eb', margin: '0 0 20px' }" />

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0' }">
      &#8212; L'&#233;quipe de Juggling Convention
    </Text>
  </BaseEmail>
</template>

<script setup lang="ts">
import { Button, Hr, Section, Text } from '@vue-email/components'

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

const title = `Vos cr\u00e9neaux de b\u00e9n\u00e9volat - ${props.conventionName}`
const preheaderText = `Vos cr\u00e9neaux pour ${props.conventionName} sont disponibles`

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
    MORNING: 'Matin',
    AFTERNOON: 'Apr\u00e8s-midi',
    EVENING: 'Soir',
  }
  return labels[slot.timeOfDay] || slot.timeOfDay
}
</script>
