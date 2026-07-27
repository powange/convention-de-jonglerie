<template>
  <div>
    <AppHeader />

    <UMain>
      <UPage>
        <UPageBody>
          <UContainer>
            <div class="py-8">
              <!-- Bouton menu mobile -->
              <div class="lg:hidden mb-4">
                <UDrawer v-model:open="drawerOpen" direction="left">
                  <UButton
                    icon="i-heroicons-bars-3"
                    variant="outline"
                    color="neutral"
                    :label="t('menu')"
                  />

                  <template #body>
                    <div class="p-4">
                      <GuideSidebar @navigate="drawerOpen = false" />
                    </div>
                  </template>
                </UDrawer>
              </div>

              <!-- Signalé uniquement aux visiteurs dont l'interface n'est pas en français :
                   inutile d'annoncer à un francophone que le guide est en français. -->
              <UAlert
                v-if="locale !== 'fr'"
                icon="i-heroicons-language"
                color="info"
                variant="subtle"
                :title="t('frenchOnly.title')"
                :description="t('frenchOnly.description')"
                class="mb-6"
              />

              <!-- lang="fr" : le guide est rédigé en français quelle que soit la langue de
                   l'interface. L'attribut signale la langue réelle du contenu aux navigateurs,
                   qui proposent alors spontanément leur traduction intégrée (Chrome, Edge et
                   les autres Chromium), et aux lecteurs d'écran pour la prononciation. -->
              <div lang="fr" class="flex gap-8">
                <!-- Sidebar desktop -->
                <aside class="hidden lg:block w-56 shrink-0">
                  <div class="sticky top-20">
                    <GuideSidebar />
                  </div>
                </aside>

                <!-- Contenu -->
                <div class="flex-1 min-w-0">
                  <slot />
                </div>
              </div>
            </div>
          </UContainer>
        </UPageBody>
      </UPage>
    </UMain>

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n({ useScope: 'local' })

const drawerOpen = ref(false)
</script>

<i18n lang="json">
{
  "fr": {
    "menu": "Menu du guide",
    "frenchOnly": {
      "title": "Guide disponible en français uniquement",
      "description": "Ce guide n'est rédigé qu'en français. Votre navigateur peut le traduire automatiquement : faites un clic droit sur la page puis choisissez « Traduire »."
    }
  },
  "en": {
    "menu": "Guide menu",
    "frenchOnly": {
      "title": "This guide is only available in French",
      "description": "The guide is written in French only. Your browser can translate it for you: right-click anywhere on the page and choose \"Translate\". This works in Chrome, Edge and other Chromium-based browsers."
    }
  }
}
</i18n>
