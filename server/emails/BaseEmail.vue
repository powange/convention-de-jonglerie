<script setup lang="ts">
import { Html, Head, Container, Section, Img, Heading, Text } from '@vue-email/components'

interface Props {
  title: string
  headerColor?: 'primary' | 'error'
}

const props = withDefaults(defineProps<Props>(), {
  headerColor: 'primary',
})

const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const headerGradient =
  props.headerColor === 'error'
    ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
    : 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)'

const headerShadow =
  props.headerColor === 'error'
    ? '0 4px 6px rgba(220, 38, 38, 0.2)'
    : '0 4px 6px rgba(124, 58, 237, 0.2)'
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
            background: headerGradient,
            color: 'white',
            padding: '20px',
            textAlign: 'center',
            borderRadius: '8px 8px 0 0',
            boxShadow: headerShadow,
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
