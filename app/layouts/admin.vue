<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Barre de navigation admin -->
    <div class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center gap-6">
            <NuxtLink to="/admin" class="flex items-center gap-2">
              <UIcon name="i-heroicons-shield-check" class="h-6 w-6 text-blue-600" />
              <span class="font-semibold text-lg">{{ $t('admin.panel') }}</span>
            </NuxtLink>
            
            <!-- Navigation admin -->
            <nav class="hidden md:flex items-center gap-4">
              <NuxtLink 
                to="/admin" 
                class="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                :class="{ 'text-blue-600 dark:text-blue-400': $route.path === '/admin' }"
              >
                {{ $t('admin.dashboard') }}
              </NuxtLink>
              <NuxtLink 
                to="/admin/users" 
                class="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                :class="{ 'text-blue-600 dark:text-blue-400': $route.path === '/admin/users' }"
              >
                {{ $t('admin.users') }}
              </NuxtLink>
              <NuxtLink 
                to="/admin/feedback" 
                class="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                :class="{ 'text-blue-600 dark:text-blue-400': $route.path === '/admin/feedback' }"
              >
                {{ $t('admin.feedback') }}
              </NuxtLink>
            </nav>
          </div>
          
          <!-- Actions -->
          <div class="flex items-center gap-4">
            <UButton 
              icon="i-heroicons-arrow-left" 
              variant="ghost" 
              color="gray"
              to="/"
            >
              {{ $t('admin.back_to_site') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Contenu de la page -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// Layout spécifique pour les pages admin
// Ce layout sera chargé uniquement quand on accède aux pages admin
definePageMeta({
  middleware: 'auth-admin'
});
</script>