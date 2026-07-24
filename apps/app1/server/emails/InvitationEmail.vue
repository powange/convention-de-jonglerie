<script setup lang="ts">
import { Text, Button, Section, Hr } from '@vue-email/components'

import BaseEmail from './BaseEmail.vue'

interface Props {
  prenom: string
  invitationLink: string
  baseUrl: string
  // Rôle affiché dans l'email : « artiste » ou « bénévole »
  roleLabel: string
  // Nom de l'événement/convention qui invite
  eventName: string
}

defineProps<Props>()
</script>

<template>
  <BaseEmail
    title="Invitation à rejoindre Juggling Convention"
    :base-url="baseUrl"
    preheader="Activez votre compte et choisissez votre mot de passe"
  >
    <Text :style="{ color: '#374151', margin: '0 0 16px' }">Bonjour {{ prenom }},</Text>

    <Text :style="{ color: '#374151', margin: '0 0 16px' }">
      Un organisateur<span v-if="eventName">
        de <strong>{{ eventName }}</strong></span
      >
      vous a ajouté comme {{ roleLabel }} sur la plateforme Juggling Convention.
    </Text>

    <Text :style="{ color: '#374151', margin: '0 0 20px' }">
      Cliquez sur le bouton ci-dessous pour activer votre compte en choisissant votre mot de passe :
    </Text>

    <Section :style="{ textAlign: 'center', margin: '0 0 24px' }">
      <Button
        :href="invitationLink"
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
        Activer mon compte
      </Button>
    </Section>

    <Text :style="{ color: '#374151', margin: '0 0 12px' }">
      <strong>Ce lien est valide pendant 7 jours.</strong>
    </Text>

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0 0 8px' }">
      Si le bouton ne fonctionne pas, copiez et collez le lien suivant dans votre navigateur :
    </Text>
    <Text :style="{ color: '#10b981', fontSize: '13px', margin: '0 0 20px' }">
      {{ invitationLink }}
    </Text>

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px' }">
      Si vous n'êtes pas concerné par cette invitation, vous pouvez ignorer cet email.
    </Text>

    <Hr :style="{ borderColor: '#e5e7eb', margin: '0 0 20px' }" />

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0' }">
      — L'équipe de Juggling Convention
    </Text>
  </BaseEmail>
</template>
