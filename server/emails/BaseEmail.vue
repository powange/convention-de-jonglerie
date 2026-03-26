<script setup lang="ts">
import {
  Html,
  Head,
  Container,
  Section,
  Img,
  Heading,
  Text,
  Link,
  Preview,
} from '@vue-email/components'

interface Props {
  title: string
  baseUrl: string
  headerColor?: 'primary' | 'error'
  preheader?: string
}

defineProps<Props>()
</script>

<template>
  <Html lang="fr">
    <Head />
    <Preview v-if="preheader">{{ preheader }}</Preview>
    <Container
      :style="{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif',
        lineHeight: '26px',
        color: '#374151',
        backgroundColor: '#f3f4f6',
        margin: '0',
        padding: '0',
      }"
    >
      <Section :style="{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px 20px' }">
        <!-- Logo + nom -->
        <table :style="{ margin: '0 0 24px', border: '0' }" cellpadding="0" cellspacing="0">
          <tr>
            <td :style="{ verticalAlign: 'middle', paddingRight: '12px' }">
              <Img
                :src="`${baseUrl}/favicons/android-chrome-192x192.png`"
                alt="Juggling Convention"
                :width="36"
                :height="36"
              />
            </td>
            <td
              :style="{
                verticalAlign: 'middle',
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
              }"
            >
              Juggling Convention
            </td>
          </tr>
        </table>

        <!-- Card -->
        <Section
          :style="{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
          }"
        >
          <!-- Title -->
          <Section :style="{ padding: '32px 32px 0' }">
            <Heading
              as="h1"
              :style="{
                margin: '0 0 24px',
                fontSize: '20px',
                fontWeight: '600',
                color: '#111827',
              }"
            >
              {{ title }}
            </Heading>
          </Section>

          <!-- Content -->
          <Section :style="{ padding: '0 32px 32px' }">
            <slot />
          </Section>
        </Section>

        <!-- Footer -->
        <Section :style="{ padding: '24px 0', textAlign: 'center' }">
          <Text :style="{ color: '#9ca3af', fontSize: '13px', margin: '0 0 12px' }">
            <Link
              :href="`${baseUrl}/profile`"
              :style="{ color: '#6b7280', textDecoration: 'underline' }"
            >
              G&#233;rer mes notifications
            </Link>
            &nbsp;&middot;&nbsp;
            <Link
              :href="`${baseUrl}/project-costs`"
              :style="{ color: '#6b7280', textDecoration: 'underline' }"
            >
              Soutenir le projet
            </Link>
          </Text>
          <Text :style="{ color: '#9ca3af', fontSize: '13px', margin: '0 0 16px' }">
            <Link
              href="https://www.facebook.com/profile.php?id=61582110660179"
              :style="{ color: '#6b7280', textDecoration: 'none', marginRight: '12px' }"
            >
              Facebook
            </Link>
            <Link
              href="https://discord.gg/DD8XnDVqzj"
              :style="{ color: '#6b7280', textDecoration: 'none' }"
            >
              Discord
            </Link>
          </Text>
          <Text :style="{ color: '#b0b6c0', fontSize: '12px', margin: '0' }">
            Cet email a &#233;t&#233; envoy&#233; automatiquement par Juggling Convention.
          </Text>
        </Section>
      </Section>
    </Container>
  </Html>
</template>
