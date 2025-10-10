<script setup lang="ts">
import { Text, Button, Section } from '@vue-email/components'

import BaseEmail from './BaseEmail.vue'

interface Props {
  title: string
  prenom: string
  message: string
  actionUrl?: string
  actionText?: string
}

defineProps<Props>()

const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'
</script>

<template>
  <BaseEmail :title="title">
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
          background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
          color: 'white',
          padding: '12px 30px',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          margin: '20px 0',
          boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)',
        }"
      >
        {{ actionText }}
      </Button>
    </Section>

    <Text>Cordialement,<br />L'équipe de Juggling Convention</Text>
  </BaseEmail>
</template>
