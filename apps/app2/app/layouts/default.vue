<template>
  <div class="min-h-screen flex flex-col bg-default">
    <AppHeader />

    <main class="flex-1">
      <slot />
    </main>

    <AppFooter />
  </div>
</template>
