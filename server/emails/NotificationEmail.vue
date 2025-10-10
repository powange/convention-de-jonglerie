<script setup lang="ts">
import { Text, Button, Section } from '@vue-email/components'

import BaseEmail from './BaseEmail.vue'

interface Props {
  title: string
  prenom: string
  message: string
  baseUrl: string
  actionUrl?: string
  actionText?: string
}

defineProps<Props>()
</script>

<template>
  <BaseEmail :title="title" :base-url="baseUrl">
    <Text>Bonjour {{ prenom }},</Text>

    <Section
      :style="{
        background: '#141837',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0',
        border: '1px solid rgba(124, 58, 237, 0.2)',
        color: '#e5e7eb',
      }"
    >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-html="message" />
    </Section>

    <Section v-if="actionUrl && actionText" :style="{ textAlign: 'center' }">
      <Button
        :href="`${baseUrl}${actionUrl}`"
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
        {{ actionText }}
      </Button>
    </Section>

    <Text>Cordialement,<br />L'équipe de Juggling Convention</Text>
  </BaseEmail>
</template>
