<template>
  <div>
    <AppHeader />

    <UMain>
      <UPage>
        <UPageBody>
          <UContainer>
            <div>
              <!-- Bouton menu mobile -->
              <div class="lg:hidden mb-4">
                <UDrawer v-model:open="drawerOpen" direction="left">
                  <UButton
                    icon="i-heroicons-bars-3"
                    variant="outline"
                    color="neutral"
                    :label="t('profil_menu')"
                  />

                  <template #body>
                    <div class="p-4">
                      <ProfileSidebar @navigate="drawerOpen = false" />
                    </div>
                  </template>
                </UDrawer>
              </div>

              <div class="flex gap-8">
                <!-- Sidebar desktop -->
                <aside class="hidden lg:block w-64 shrink-0">
                  <div class="sticky top-20">
                    <ProfileSidebar />
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
// Portée globale : voir le layout du guide — un bloc local n'a pas de repli de langue, et les
// douze locales absentes de celui-ci affichaient la clé brute.
const { t } = useI18n()

const drawerOpen = ref(false)
</script>
