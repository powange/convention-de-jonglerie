<script setup lang="ts">
import { Text, Button, Section } from '@vue-email/components'

import BaseEmail from './BaseEmail.vue'

interface Props {
  prenom: string
  reasonTitle: string
  reasonMessage: string
  baseUrl: string
}

defineProps<Props>()
</script>

<template>
  <BaseEmail title="⚠️ Suppression de votre compte" header-color="error" :base-url="baseUrl">
    <Text>Bonjour {{ prenom }},</Text>

    <Text
      >Nous vous informons que votre compte sur la plateforme Juggling Convention a été supprimé par
      nos administrateurs.</Text
    >

    <Section
      :style="{
        background: '#2d1f2e',
        borderLeft: '4px solid #dc2626',
        padding: '20px',
        margin: '20px 0',
        borderRadius: '0 8px 8px 0',
      }"
    >
      <Text :style="{ fontWeight: 'bold', color: '#fca5a5', marginBottom: '10px' }"
        >Motif de la suppression :</Text
      >
      <Text
        ><strong>{{ reasonTitle }}</strong></Text
      >
      <Text :style="{ marginTop: '10px' }">{{ reasonMessage }}</Text>
    </Section>

    <Text
      ><strong>Cette action est définitive.</strong> Toutes vos données personnelles ont été
      supprimées de nos serveurs conformément à notre politique de confidentialité.</Text
    >

    <Text
      >Si vous pensez que cette suppression est une erreur ou si vous avez des questions, vous
      pouvez nous contacter :</Text
    >

    <Section :style="{ textAlign: 'center' }">
      <Button
        href="mailto:contact@conventionsdejonglerie.fr"
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
        Nous contacter
      </Button>
    </Section>

    <Text
      >Nous vous remercions pour votre participation à la communauté des conventions de
      jonglerie.</Text
    >

    <Text>Cordialement,<br />L'équipe de Juggling Convention</Text>
  </BaseEmail>
</template>
