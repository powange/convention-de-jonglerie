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
import { computed } from 'vue'

import {
  CHEMIN_DES_PREFERENCES,
  habillageDeCourriel,
  type HabillageDeCourriel,
} from '../utils/habillage-courriel'

interface Props {
  title: string
  baseUrl: string
  headerColor?: 'primary' | 'error'
  preheader?: string
  /**
   * L'emballage du courriel dans la langue du destinataire.
   *
   * Absent, il retombe sur le français — c'est le cas des six autres gabarits, dont les appelants
   * ne connaissent pas encore la langue de la personne. Le défaut est calculé dans un `.ts` et non
   * écrit ici : `check-i18n` ne scanne pas les `.vue` du serveur, et des clés qui ne vivraient que dans
   * ce fichier passeraient pour inutilisées.
   */
  habillage?: HabillageDeCourriel
}

const props = defineProps<Props>()

const emballage = computed(() => props.habillage ?? habillageDeCourriel('fr'))
</script>

<template>
  <Html :lang="emballage.lang">
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
          <tbody>
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
          </tbody>
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
            <!-- `/profile/notifications`, et non `/profile` : c'est là que vivent les
                 préférences. Le lien menait à la page du profil, où rien ne parle de
                 notifications — on cliquait « Gérer mes notifications » et il fallait les
                 chercher. -->
            <Link
              :href="`${baseUrl}${CHEMIN_DES_PREFERENCES}`"
              :style="{ color: '#6b7280', textDecoration: 'underline' }"
            >
              {{ emballage.gererNotifications }}
            </Link>
            &nbsp;&middot;&nbsp;
            <Link
              :href="`${baseUrl}/project-costs`"
              :style="{ color: '#6b7280', textDecoration: 'underline' }"
            >
              {{ emballage.soutenirLeProjet }}
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
            {{ emballage.envoiAutomatique }}
          </Text>
        </Section>
      </Section>
    </Container>
  </Html>
</template>
