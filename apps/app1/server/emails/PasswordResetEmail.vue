<script setup lang="ts">
import { Text, Button, Section, Hr } from '@vue-email/components'

import BaseEmail from './BaseEmail.vue'

interface Props {
  prenom: string
  resetLink: string
  baseUrl: string
}

defineProps<Props>()
</script>

<template>
  <BaseEmail
    title="R&#233;initialisation de mot de passe"
    :base-url="baseUrl"
    preheader="Un lien pour r&#233;initialiser votre mot de passe Juggling Convention"
  >
    <Text :style="{ color: '#374151', margin: '0 0 16px' }">Bonjour {{ prenom }},</Text>

    <Text :style="{ color: '#374151', margin: '0 0 16px' }">
      Vous avez demand&#233; la r&#233;initialisation de votre mot de passe pour votre compte
      Juggling Convention.
    </Text>

    <Text :style="{ color: '#374151', margin: '0 0 20px' }">
      Cliquez sur le bouton ci-dessous pour d&#233;finir un nouveau mot de passe :
    </Text>

    <Section :style="{ textAlign: 'center', margin: '0 0 24px' }">
      <Button
        :href="resetLink"
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
        R&#233;initialiser mon mot de passe
      </Button>
    </Section>

    <Text :style="{ color: '#374151', margin: '0 0 12px' }">
      <strong>Ce lien est valide pendant 1 heure.</strong>
    </Text>

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0 0 8px' }">
      Si le bouton ne fonctionne pas, copiez et collez le lien suivant dans votre navigateur :
    </Text>
    <Text :style="{ color: '#10b981', fontSize: '13px', margin: '0 0 20px' }">
      {{ resetLink }}
    </Text>

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px' }">
      Si vous n'avez pas demand&#233; cette r&#233;initialisation, vous pouvez ignorer cet email.
      Votre mot de passe restera inchang&#233;.
    </Text>

    <Hr :style="{ borderColor: '#e5e7eb', margin: '0 0 20px' }" />

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0' }">
      &#8212; L'&#233;quipe de Juggling Convention
    </Text>
  </BaseEmail>
</template>
