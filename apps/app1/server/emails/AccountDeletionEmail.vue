<script setup lang="ts">
import { Text, Button, Section, Hr } from '@vue-email/components'

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
  <BaseEmail
    title="Suppression de votre compte"
    header-color="error"
    :base-url="baseUrl"
    preheader="Votre compte Juggling Convention a &#233;t&#233; supprim&#233;"
  >
    <Text :style="{ color: '#374151', margin: '0 0 16px' }">Bonjour {{ prenom }},</Text>

    <Text :style="{ color: '#374151', margin: '0 0 20px' }">
      Nous vous informons que votre compte sur la plateforme Juggling Convention a &#233;t&#233;
      supprim&#233; par nos administrateurs.
    </Text>

    <Section
      :style="{
        backgroundColor: '#fef2f2',
        borderLeft: '4px solid #dc2626',
        padding: '16px 20px',
        margin: '0 0 20px',
        borderRadius: '0 6px 6px 0',
      }"
    >
      <Text :style="{ fontWeight: '600', color: '#991b1b', margin: '0 0 8px', fontSize: '14px' }">
        Motif de la suppression :
      </Text>
      <Text :style="{ color: '#374151', margin: '0 0 4px' }">
        <strong>{{ reasonTitle }}</strong>
      </Text>
      <Text :style="{ color: '#6b7280', margin: '0', fontSize: '14px' }">
        {{ reasonMessage }}
      </Text>
    </Section>

    <Text :style="{ color: '#374151', margin: '0 0 12px' }">
      <strong>Cette action est d&#233;finitive.</strong> Toutes vos donn&#233;es personnelles ont
      &#233;t&#233; supprim&#233;es de nos serveurs conform&#233;ment &#224; notre politique de
      confidentialit&#233;.
    </Text>

    <Text :style="{ color: '#374151', margin: '0 0 20px' }">
      Si vous pensez que cette suppression est une erreur ou si vous avez des questions :
    </Text>

    <Section :style="{ textAlign: 'center', margin: '0 0 24px' }">
      <Button
        href="mailto:contact@conventionsdejonglerie.fr"
        :style="{
          display: 'inline-block',
          backgroundColor: '#374151',
          color: '#ffffff',
          padding: '12px 32px',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: '600',
          fontSize: '14px',
        }"
      >
        Nous contacter
      </Button>
    </Section>

    <Hr :style="{ borderColor: '#e5e7eb', margin: '0 0 20px' }" />

    <Text :style="{ color: '#6b7280', fontSize: '14px', margin: '0' }">
      &#8212; L'&#233;quipe de Juggling Convention
    </Text>
  </BaseEmail>
</template>
