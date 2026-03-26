<script setup lang="ts">
import { Text, Button, Section, Hr } from '@vue-email/components'

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
  <BaseEmail
    :title="title"
    :base-url="baseUrl"
    :preheader="message.replace(/<[^>]*>/g, '').substring(0, 120)"
  >
    <Text :style="{ color: '#374151', margin: '0 0 16px' }">Bonjour {{ prenom }},</Text>

    <Section
      :style="{
        backgroundColor: '#f9fafb',
        padding: '16px 20px',
        borderRadius: '6px',
        borderLeft: '4px solid #10b981',
        margin: '0 0 24px',
      }"
    >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div :style="{ color: '#374151', fontSize: '14px', lineHeight: '1.6' }" v-html="message" />
    </Section>

    <Section v-if="actionUrl && actionText" :style="{ textAlign: 'center', margin: '0 0 24px' }">
      <Button
        :href="`${baseUrl}${actionUrl}`"
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
        {{ actionText }}
      </Button>
    </Section>

    <Hr :style="{ borderColor: '#e5e7eb', margin: '0 0 20px' }" />

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0' }">
      &#8212; L'&#233;quipe de Juggling Convention
    </Text>
  </BaseEmail>
</template>
