<script setup lang="ts">
import { Text, Button, Section, Hr } from '@vue-email/components'

import BaseEmail from './BaseEmail.vue'

interface Props {
  code: string
  prenom: string
  email: string
  baseUrl: string
}

const props = defineProps<Props>()

const verifyUrl = `${props.baseUrl}/verify-email?email=${encodeURIComponent(props.email)}`
</script>

<template>
  <BaseEmail
    title="V&#233;rification de votre compte"
    :base-url="baseUrl"
    preheader="Votre code de v&#233;rification pour Juggling Convention"
  >
    <Text :style="{ color: '#374151', margin: '0 0 16px' }">Bonjour {{ prenom }},</Text>

    <Text :style="{ color: '#374151', margin: '0 0 16px' }">
      Bienvenue dans la communaut&#233; des conventions de jonglerie !
    </Text>

    <Text :style="{ color: '#374151', margin: '0 0 20px' }">
      Pour finaliser votre inscription, vous pouvez :
    </Text>

    <Section :style="{ textAlign: 'center', margin: '0 0 16px' }">
      <Button
        :href="verifyUrl"
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
        V&#233;rifier mon compte
      </Button>
    </Section>

    <Text :style="{ textAlign: 'center', color: '#9ca3af', margin: '16px 0', fontSize: '13px' }">
      <strong>OU</strong>
    </Text>

    <Text :style="{ color: '#374151', margin: '0 0 12px' }">
      Saisir manuellement ce code de v&#233;rification :
    </Text>

    <Section
      :style="{
        backgroundColor: '#f9fafb',
        color: '#111827',
        padding: '16px',
        fontSize: '28px',
        fontWeight: '700',
        textAlign: 'center',
        borderRadius: '6px',
        letterSpacing: '4px',
        margin: '0 0 20px',
        border: '1px solid #e5e7eb',
      }"
    >
      {{ code }}
    </Section>

    <Text :style="{ color: '#374151', margin: '0 0 12px' }">
      <strong>Ce code est valide pendant 15 minutes.</strong>
    </Text>

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px' }">
      Si vous n'avez pas cr&#233;&#233; de compte, vous pouvez ignorer cet email.
    </Text>

    <Hr :style="{ borderColor: '#e5e7eb', margin: '0 0 20px' }" />

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0' }">
      &#8212; L'&#233;quipe de Juggling Convention
    </Text>
  </BaseEmail>
</template>
