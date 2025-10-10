<script setup lang="ts">
import { Html, Head, Container, Section, Img, Heading, Text } from '@vue-email/components'

interface Props {
  title: string
  baseUrl: string
  headerColor?: 'primary' | 'error'
}

defineProps<Props>()

const headerBackground = '#0f172a'
</script>

<template>
  <Html lang="fr">
    <Head />
    <Container
      :style="{
        fontFamily: 'Arial, sans-serif',
        lineHeight: 1.6,
        color: '#e5e7eb',
        backgroundColor: '#0f1629',
      }"
    >
      <Section :style="{ maxWidth: '600px', margin: '0 auto', padding: '20px' }">
        <!-- Header -->
        <Section
          :style="{
            background: headerBackground,
            color: 'white',
            padding: '20px',
            textAlign: 'center',
            borderRadius: '8px 8px 0 0',
          }"
        >
          <Img
            :src="`${baseUrl}/favicons/android-chrome-192x192.png`"
            alt="Juggling Convention"
            :width="80"
            :height="80"
            :style="{ marginBottom: '10px' }"
          />
          <Heading as="h1" :style="{ margin: 0, fontSize: '24px' }">
            {{ title }}
          </Heading>
        </Section>

        <!-- Content -->
        <Section
          :style="{
            background: '#1a1f4a',
            padding: '30px',
            borderRadius: '0 0 8px 8px',
            border: '1px solid rgba(124, 58, 237, 0.3)',
          }"
        >
          <slot />
        </Section>

        <!-- Footer -->
        <Section :style="{ textAlign: 'center', marginTop: '20px' }">
          <Text :style="{ color: '#9ca3af', fontSize: '14px' }">
            Cet email a été envoyé automatiquement, merci de ne pas y répondre.
          </Text>
        </Section>
      </Section>
    </Container>
  </Html>
</template>
