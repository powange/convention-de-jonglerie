<script setup lang="ts">
import { Text, Button, Section } from '@vue-email/components'

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
  <BaseEmail title="Vérification de votre compte" :base-url="baseUrl">
    <Text>Bonjour {{ prenom }},</Text>

    <Text>Bienvenue dans la communauté des conventions de jonglerie ! 🎪</Text>

    <Text>Pour finaliser votre inscription, vous pouvez :</Text>

    <Section :style="{ textAlign: 'center' }">
      <Button
        :href="verifyUrl"
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
        Vérifier mon compte
      </Button>
    </Section>

    <Text :style="{ textAlign: 'center', margin: '20px 0', color: '#9ca3af' }">
      <strong>OU</strong>
    </Text>

    <Text>Saisir manuellement ce code de vérification :</Text>

    <Section
      :style="{
        background: '#141837',
        color: '#a78bfa',
        padding: '15px',
        fontSize: '28px',
        fontWeight: 'bold',
        textAlign: 'center',
        borderRadius: '8px',
        letterSpacing: '3px',
        margin: '20px 0',
        border: '2px solid rgba(124, 58, 237, 0.4)',
      }"
    >
      {{ code }}
    </Section>

    <Text><strong>Ce code est valide pendant 15 minutes.</strong></Text>

    <Text>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</Text>

    <Text>À bientôt sur la plateforme !<br />L'équipe de Juggling Convention</Text>
  </BaseEmail>
</template>
