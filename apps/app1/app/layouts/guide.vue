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
                    :label="t('guide.menu')"
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
                :title="t('guide.french_only_title')"
                :description="t('guide.french_only_description')"
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
// Portée globale : un bloc `<i18n>` local ne bénéficie pas du repli de langue, si bien que les
// onze locales qu'il ne déclarait pas affichaient la clé brute. Ces blocs échappent en outre à
// l'outillage i18n, qui ne lit que les fichiers de traduction — la dérive passait inaperçue.
const { t, locale } = useI18n()

const drawerOpen = ref(false)
</script>
