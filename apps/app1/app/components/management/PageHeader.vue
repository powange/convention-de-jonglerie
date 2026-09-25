<template>
  <div data-entete-page class="flex items-start gap-3 min-w-0">
    <UIcon v-if="icone" data-entete-icone :name="icone" :class="classeIcone" />
    <div class="min-w-0">
      <h1 :class="classeTitre">{{ titre }}</h1>
      <p v-if="description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {{ description }}
      </p>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ICONE_DE_MODULE } from '~/utils/couleurs-de-module'
import { moduleDeGestion } from '~/utils/modules-de-gestion'

/**
 * Le titre d'un écran de gestion : l'icône du module, le titre, la description.
 *
 * Il existe pour deux raisons mesurées le 25/09/2026 sur les 52 écrans de gestion.
 *
 * **L'icône et sa couleur dérivaient.** Chaque page les redéclarait à la main alors que l'accueil
 * de gestion les annonçait déjà pour le même module : treize pages n'affichaient aucune icône,
 * cinq en affichaient une autre, huit avaient la bonne mais pas la bonne couleur. Ce composant ne
 * les reçoit donc PAS en props — il les lit dans le registre, d'après la route. La contradiction
 * entre l'accueil et la page devient impossible.
 *
 * **Le gabarit était recopié.** Quarante-quatre pages portaient l'icône dans leur `h1`, avec la
 * même disposition, et sept variantes de classes s'y étaient installées.
 *
 * ⚠️ Il ne prend en charge NI la marge NI l'enveloppe de la page. Les conteneurs qui l'entourent
 * varient trop d'un écran à l'autre — `mb-6` ici, `space-y-6` là, un conteneur flex avec des
 * actions sur quatorze pages — et les absorber aurait produit un composant à huit props qui ne
 * simplifierait rien. Les pages restent maîtresses de leur mise en page ; ce composant ne fait que
 * le titre.
 */
const props = withDefaults(
  defineProps<{
    titre: string
    /** Affichée sous le titre, en petit. */
    description?: string
    /**
     * `page` pour un écran de module, `fiche` pour un enregistrement.
     *
     * La distinction est délibérée : un titre qui nomme CE groupe de stock ou CET objet se tient
     * un cran en dessous d'un titre d'écran. C'est une hiérarchie, pas un écart à corriger.
     */
    niveau?: 'page' | 'fiche'
    /**
     * Pour désigner un module que la route ne donne pas.
     *
     * Rare : une page qui vit ailleurs que sous le chemin du module qu'elle sert.
     */
    module?: string
  }>(),
  { description: undefined, niveau: 'page', module: undefined }
)

const route = useRoute()

const moduleCourant = computed(() => moduleDeGestion(props.module ?? route.path))

const icone = computed(() => moduleCourant.value?.icone)

const classeIcone = computed(() => {
  const couleur = moduleCourant.value?.couleur
  const taille = props.niveau === 'fiche' ? 'size-6' : 'size-7'
  // `mt-0.5` aligne l'icône sur la première ligne du titre, et non sur le bloc entier — lequel
  // descend dès qu'une description s'ajoute dessous.
  return `${taille} shrink-0 mt-0.5 ${couleur ? ICONE_DE_MODULE[couleur] : ''}`
})

const classeTitre = computed(() =>
  props.niveau === 'fiche' ? 'text-xl font-semibold' : 'text-2xl font-bold'
)
</script>
