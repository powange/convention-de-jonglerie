<template>
  <div class="space-y-8">
    <!-- En-tête profil -->
    <ProfileHeader />

    <!-- Catégories utilisateur -->
    <ProfileUserCategoriesCard />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Statistiques -->
      <UCard
        class="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
      >
        <template #header>
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"
            >
              <UIcon
                name="i-heroicons-chart-bar"
                class="w-5 h-5 text-blue-600 dark:text-blue-400"
              />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('profile.my_statistics') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ $t('profile.platform_activity') }}
              </p>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <div
            class="group p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 transition-all duration-200 hover:shadow-md"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 bg-primary-100 dark:bg-primary-800 rounded-lg flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-calendar-days"
                    class="w-4 h-4 text-primary-600 dark:text-primary-400"
                  />
                </div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
                  $t('profile.conventions_created')
                }}</span>
              </div>
              <UBadge color="primary" variant="soft" size="lg">
                <UIcon
                  v-if="statsLoading"
                  name="i-heroicons-arrow-path"
                  class="animate-spin w-4 h-4"
                />
                <template v-else>{{ myConventionsCount }}</template>
              </UBadge>
            </div>
          </div>

          <div
            class="group p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 transition-all duration-200 hover:shadow-md"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 bg-yellow-100 dark:bg-yellow-800 rounded-lg flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-star"
                    class="w-4 h-4 text-yellow-600 dark:text-yellow-400"
                  />
                </div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
                  $t('profile.favorites')
                }}</span>
              </div>
              <UBadge color="warning" variant="soft" size="lg">
                <UIcon
                  v-if="statsLoading"
                  name="i-heroicons-arrow-path"
                  class="animate-spin w-4 h-4"
                />
                <template v-else>{{ favoritesCount }}</template>
              </UBadge>
            </div>
          </div>

          <div
            class="group p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 transition-all duration-200 hover:shadow-md"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 bg-red-100 dark:bg-red-800 rounded-lg flex items-center justify-center"
                >
                  <UIcon name="i-heroicons-heart" class="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
                  $t('profile.favorites_received')
                }}</span>
              </div>
              <UBadge color="error" variant="soft" size="lg">
                <UIcon
                  v-if="statsLoading"
                  name="i-heroicons-arrow-path"
                  class="animate-spin w-4 h-4"
                />
                <template v-else>{{ totalFavoritesReceived }}</template>
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Actions rapides -->
      <UCard
        class="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
      >
        <template #header>
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center"
            >
              <UIcon name="i-heroicons-bolt" class="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('profile.quick_actions') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ $t('profile.direct_access') }}
              </p>
            </div>
          </div>
        </template>

        <div class="space-y-3">
          <UButton
            icon="i-heroicons-plus"
            variant="soft"
            color="primary"
            size="lg"
            block
            to="/conventions/add"
            class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
          >
            {{ $t('profile.create_convention') }}
          </UButton>

          <UButton
            icon="i-heroicons-calendar-days"
            variant="soft"
            color="info"
            size="lg"
            block
            to="/profile/mes-conventions"
            class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
          >
            {{ $t('navigation.my_conventions') }}
          </UButton>

          <UButton
            icon="i-heroicons-star"
            variant="soft"
            color="warning"
            size="lg"
            block
            to="/favorites"
            class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
          >
            {{ $t('navigation.my_favorites') }}
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'profile',
  middleware: 'auth-protected',
})

const {
  stats: profileStats,
  loading: statsLoading,
  ensureInitialized: initStats,
} = useProfileStats()

const myConventionsCount = computed(() => profileStats.value?.conventionsCreated ?? 0)
const favoritesCount = computed(() => profileStats.value?.editionsFavorited ?? 0)
const totalFavoritesReceived = computed(() => profileStats.value?.favoritesReceived ?? 0)

onMounted(async () => {
  await initStats()
})
</script>
