<template>
  <!-- Même organisation que le layout `profile` d'app1 : barre latérale permanente à partir de
       `lg`, tiroir en dessous. -->
  <div class="min-h-screen flex flex-col bg-default">
    <AppHeader />

    <main class="flex-1">
      <UContainer class="py-8">
        <div class="mb-4 lg:hidden">
          <UDrawer v-model:open="tiroirOuvert" direction="left">
            <UButton
              icon="i-heroicons-bars-3"
              variant="outline"
              color="neutral"
              label="Menu du profil"
            />
            <template #body>
              <div class="p-4">
                <ProfileSidebar @navigate="tiroirOuvert = false" />
              </div>
            </template>
          </UDrawer>
        </div>

        <div class="flex gap-8">
          <aside class="hidden w-64 shrink-0 lg:block">
            <div class="sticky top-20">
              <ProfileSidebar />
            </div>
          </aside>
          <div class="min-w-0 flex-1">
            <slot />
          </div>
        </div>
      </UContainer>
    </main>

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
const tiroirOuvert = ref(false)
</script>
