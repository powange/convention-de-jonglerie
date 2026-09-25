<template>
  <!-- Sur mobile, une section ne s'affiche que si elle est celle qu'on a ouverte ; au-delà de
       `md`, toutes restent affichées, comme avant. Le seuil est porté par Tailwind et non par
       une mesure de largeur en JavaScript : le rendu serveur et le navigateur s'accordent. -->
  <div ref="racine" :class="ouverte ? undefined : 'hidden md:block'">
    <UCard>
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <UIcon :name="icone" :class="classeIcone" />
          <h2 class="text-lg font-semibold">{{ title }}</h2>
        </div>
        <slot />
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { categorieDeGestion } from '~/utils/categories-de-gestion'

interface Props {
  /**
   * Identifiant repris dans l'URL : le garder stable, il est partageable.
   *
   * Il désigne aussi la catégorie dans le registre, d'où viennent l'icône et sa couleur. Celles-ci
   * ne sont donc PAS des props : la barre latérale lit le même registre, et deux surfaces qui
   * puisent à la même source ne peuvent plus se contredire.
   */
  id: string
  title: string
}

const props = defineProps<Props>()

const categorie = computed(() => categorieDeGestion(props.id))
const icone = computed(() => categorie.value?.icone ?? 'i-heroicons-square-3-stack-3d')
const classeIcone = computed(() => categorie.value?.classeIcone ?? 'text-primary-500')

const racine = ref<HTMLElement | null>(null)
const contexte = useCategoriesGestion()

const ouverte = computed(() => contexte?.categorieOuverte.value === props.id)

// L'inscription se fait au montage : c'est là que l'élément existe, et l'ordre du document en
// découle. Une section masquée par son `v-if` se retire d'elle-même de la liste.
onMounted(() =>
  contexte?.enregistrer({
    id: props.id,
    titre: props.title,
    icone: icone.value,
    classeIcone: classeIcone.value,
    element: () => racine.value,
  })
)
onUnmounted(() => contexte?.oublier(props.id))
</script>
