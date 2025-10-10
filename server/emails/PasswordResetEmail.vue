<script setup lang="ts">
import { Text, Button, Section } from '@vue-email/components'

import BaseEmail from './BaseEmail.vue'

interface Props {
  prenom: string
  resetLink: string
  baseUrl: string
}

defineProps<Props>()
</script>

<template>
  <BaseEmail title="🔐 Réinitialisation de mot de passe" :base-url="baseUrl">
    <Text>Bonjour {{ prenom }},</Text>

    <Text
      >Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Juggling
      Convention.</Text
    >

    <Text>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</Text>

    <Section :style="{ textAlign: 'center' }">
      <Button
        :href="resetLink"
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
        Réinitialiser mon mot de passe
      </Button>
    </Section>

    <Text><strong>Ce lien est valide pendant 1 heure.</strong></Text>

    <Text
      >Si le bouton ne fonctionne pas, vous pouvez copier et coller le lien suivant dans votre
      navigateur :</Text
    >
    <Text :style="{ wordBreak: 'break-all', color: '#a78bfa', fontSize: '14px' }">{{
      resetLink
    }}</Text>

    <Text
      >Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email. Votre mot
      de passe restera inchangé.</Text
    >

    <Text>Cordialement,<br />L'équipe de Juggling Convention</Text>
  </BaseEmail>
</template>
