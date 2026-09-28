<template>
  <!--
    Pendant la recherche, le champ prend tout l'en-tête : la région de gauche (le logo) est masquée
    et celle de droite passe en pleine largeur. Sur mobile, où l'en-tête porte déjà quatre boutons,
    un champ qui partage la ligne n'est pas utilisable.

    C'est la classe passée à la région de gauche qui masque le logo, et non un `v-if` dans le slot
    `#title` : un slot vide fait retomber `UHeader` sur son titre par défaut, et « Nuxt UI »
    s'affichait alors à la place du logo. Masquer la région entière évite le piège et libère
    vraiment la largeur — un simple `hidden` sur le logo laissait sa colonne occuper sa part de la
    ligne, et le champ plafonnait à la moitié de l'en-tête.
  -->
  <UHeader
    :ui="{
      title: '',
      toggle: 'hidden',
      left: rechercheOuverte ? 'hidden' : '',
      right: rechercheOuverte ? 'w-full' : '',
    }"
  >
    <template #title>
      <div class="flex flex-row items-center gap-2">
        <UiLogoJc class="h-10 md:h-16 w-auto text-black dark:text-white" />
        <span class="hidden sm:inline text-xl font-bold">{{ $t('app.title') }}</span>
      </div>
    </template>

    <template #right>
      <ClientOnly>
        <!-- Recherche d'une édition par son nom : ne s'affiche que sur l'accueil, dont elle
             recharge la liste en écartant les autres filtres (cf. HomeSearch.vue) -->
        <HomeSearch v-model:open="rechercheOuverte" />

        <!--
          Tout le reste s'efface le temps de la recherche : c'est ce qui libère la largeur.

          `v-show` et non `v-if` : un `v-if` DÉMONTE la messagerie et le centre de notifications à
          chaque ouverture de la loupe, et les remonte à chaque fermeture — donc relance leur
          `onMounted` (requête de compteurs, connexion SSE) à chaque va-et-vient. `contents` rend le
          conteneur transparent à la mise en page flexible de l'en-tête, et `v-show` pose un
          `display: none` en ligne qui l'emporte quand il faut masquer.
        -->
        <div v-show="!rechercheOuverte" class="contents">
          <!-- Groupe de boutons superposés sur mobile -->
          <div class="flex flex-row gap-2">
            <!-- Bouton de bascule clair/sombre (masqué sur mobile, dans le drawer) -->
            <ClientOnly>
              <UColorModeSwitch size="sm" color="secondary" class="hidden md:inline-flex" />
              <template #fallback>
                <div class="hidden md:block w-6 h-6 sm:w-8 sm:h-8" />
              </template>
            </ClientOnly>

            <!-- Sélecteur de langue (masqué sur mobile, dans le drawer) -->
            <UiSelectLanguage class="hidden md:block" />
          </div>

          <!-- Navigation principale -->
          <div v-if="authStore.isAuthenticated" class="hidden md:flex items-center gap-2">
            <UButton
              icon="i-heroicons-star"
              size="sm"
              color="neutral"
              variant="ghost"
              to="/favorites"
            >
              {{ $t('navigation.my_favorites') }}
            </UButton>
          </div>

          <!-- Bouton messagerie (si connecté) -->
          <MessengerHeaderButton v-if="authStore.isAuthenticated" />

          <!-- Centre de notifications (si connecté) -->
          <NotificationsCenter v-if="authStore.isAuthenticated" />

          <!-- Dropdown utilisateur ou boutons connexion -->
          <UserAuthSection />
        </div>
      </ClientOnly>
    </template>
  </UHeader>
</template>

<script lang="ts" setup>
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()

/**
 * La recherche de l'accueil est-elle déployée ?
 *
 * L'état vit ici parce que c'est ici que sont les éléments à masquer. `HomeSearch` le referme
 * lui-même quand on quitte l'accueil, sans quoi l'en-tête resterait amputé sur les pages suivantes.
 */
const rechercheOuverte = ref(false)
</script>
