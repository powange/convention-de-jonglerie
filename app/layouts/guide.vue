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

              <div class="flex gap-8">
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
const { t } = useI18n({ useScope: 'local' })

const drawerOpen = ref(false)
</script>

<i18n lang="json">
{
  "fr": {
    "menu": "Menu du guide"
  }
}
</i18n>
