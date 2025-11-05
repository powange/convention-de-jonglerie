<template>
  <div>
    <AppHeader />

    <UMain>
      <UPage>
        <UPageBody>
          <UContainer>
            <slot />
          </UContainer>
        </UPageBody>
      </UPage>
    </UMain>

    <AppFooter />
  </div>
</template>
