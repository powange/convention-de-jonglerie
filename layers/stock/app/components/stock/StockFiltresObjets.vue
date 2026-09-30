<!--
  La barre de filtres des tableaux d'objets : recherche, groupe, tags.

  Un composant et non trois blocs recopiés : la page « ce qui manque » en pose deux, un par
  onglet, et la page des emprunts pose la même chose. Trois copies d'un même formulaire finissent
  toujours par diverger sur un détail — une largeur, un libellé, une pastille oubliée — et c'est
  alors l'utilisateur qui découvre que deux écrans ne se filtrent pas pareil.

  Les listes déroulantes se construisent sur les objets REÇUS, pas sur le catalogue de l'édition :
  un groupe dont rien n'est affiché n'a rien à proposer, et le choisir ne viderait pas seulement
  le tableau — il ferait douter du filtre. Un filtre dont la liste serait vide disparaît donc.
-->
<template>
  <!--
    ⚠️ LE TEXTE D'AIDE VA SOUS LA BARRE, et non dans un `UFormField` autour du champ.

    Première tentative : `UFormField :help`. Le champ devenait alors PLUS HAUT que les deux listes
    déroulantes à côté de lui, et la rangée, centrée, remontait sa saisie au-dessus de la leur —
    trois contrôles sur une ligne dont un décalé. Passer la rangée en `items-start` déplaçait le
    problème au lieu de le résoudre. Mesuré, pas supposé : un test Playwright compare les
    ordonnées des saisies.

    Une ligne sous la barre ne touche à aucun alignement, et dit la même chose une fois pour la
    barre entière plutôt qu'une fois par champ.
  -->
  <div class="flex flex-col gap-1">
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="saisie"
        icon="i-heroicons-magnifying-glass"
        :placeholder="t('gestion.stock.name_filter_placeholder')"
        :aria-label="t('gestion.stock.name_filter_placeholder')"
        class="w-56"
        @keydown.enter="appliquer"
      >
        <template v-if="saisie" #trailing>
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-heroicons-x-mark"
            :aria-label="t('common.clear')"
            @click="effacerLaRecherche"
          />
        </template>
      </UInput>

      <!-- Multiples : on fait la cuisine ET la scène dans la même séance. Les sélections se
           cumulent en OU à l'intérieur d'un filtre, et les filtres se composent entre eux.

           `USelectMenu` et non `USelect` : seul le premier gère le mode multiple. -->
      <USelectMenu
        v-if="optionsGroupes.length > 0"
        v-model="groupes"
        :items="optionsGroupes"
        multiple
        :placeholder="t('gestion.stock.loan_group_all')"
        :aria-label="t('gestion.stock.loan_group_all')"
        class="w-52"
        :ui="{ content: 'min-w-fit' }"
      >
        <template #default="{ modelValue: choisis }">
          <span v-if="!choisis?.length" class="text-gray-400">
            {{ t('gestion.stock.loan_group_all') }}
          </span>
          <span v-else class="truncate">{{ choisis.map((g) => g.label).join(', ') }}</span>
        </template>
      </USelectMenu>

      <USelectMenu
        v-if="optionsTags.length > 0"
        v-model="tags"
        :items="optionsTags"
        multiple
        :placeholder="t('gestion.stock.loan_tag_all')"
        :aria-label="t('gestion.stock.loan_tag_all')"
        class="w-52"
        :ui="{ content: 'min-w-fit' }"
      >
        <!-- Les pastilles dans le champ fermé : on reconnaît un tag à sa couleur avant de lire son
             nom, et c'est le composant partagé qui sait la rendre. -->
        <template #default="{ modelValue: choisis }">
          <span v-if="!choisis?.length" class="text-gray-400">
            {{ t('gestion.stock.loan_tag_all') }}
          </span>
          <div v-else class="flex flex-wrap gap-1">
            <StockTagBadge
              v-for="tag in choisis"
              :key="tag.value"
              :tag="{ name: tag.label, color: tag.color }"
              size="xs"
            />
          </div>
        </template>
        <template #item-leading="{ item: option }">
          <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: option.color }" />
        </template>
      </USelectMenu>

      <!-- Tout relâcher d'un geste. N'apparaît qu'une fois quelque chose posé : un bouton
           « effacer » en permanence sur une barre vierge invite à chercher ce qu'il effacerait. -->
      <UButton
        v-if="quelqueChoseEstPose"
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-heroicons-x-mark"
        @click="toutEffacer"
      >
        {{ t('common.reset') }}
      </UButton>
    </div>

    <!-- La précision qui manquait : chercher « rallonge » ne remonte pas un objet dont seule la
         description en mentionne une, et rien ne le disait. -->
    <p class="text-xs text-gray-500 dark:text-gray-400">
      {{ t('gestion.stock.name_filter_help') }}
    </p>
  </div>
</template>

<script setup lang="ts">
// `useSaisieTemporisee` vient des composables de l'application, pas de ce layer : elle sert aussi
// à la trésorerie et aux artistes. Passer par `#imports` plutôt que de compter sur l'auto-import
// depuis un layer, comme le fait déjà la page de validation du module Repas.
import { useSaisieTemporisee } from '#imports'

import {
  groupesDesObjets,
  tagsDesObjets,
  type ObjetRangeable,
} from '../../utils/filtres-objets-stock'

/** Ce que porte une option de groupe, telle que `USelectMenu` la rend et la relit. */
export interface OptionGroupe {
  label: string
  value: number
}

/** Une option de tag porte sa couleur : la pastille se dessine sans retourner au catalogue. */
export interface OptionTag extends OptionGroupe {
  color: string
}

const props = defineProps<{
  /** Les objets sur lesquels les listes déroulantes se construisent, filtres NON appliqués. */
  objets: ObjetRangeable[]
}>()

/**
 * Les trois filtres vivent chez l'appelant.
 *
 * Chaque onglet a les siens et les vide à sa façon ; les garder ici obligerait la page à aller
 * les chercher dans une référence de composant pour les remettre à zéro.
 *
 * Groupes et tags portent des OBJETS d'option, pas des identifiants : c'est ce que `USelectMenu`
 * met et relit dans son `v-model`, et lui donner des nombres afficherait un champ vide alors que
 * le filtre, lui, serait bel et bien posé.
 */
const recherche = defineModel<string>('recherche', { default: '' })
const groupes = defineModel<OptionGroupe[]>('groupes', { default: () => [] })
const tags = defineModel<OptionTag[]>('tags', { default: () => [] })

/*
 * ⚠️ LA RECHERCHE EST TEMPORISÉE ICI, dans le composant, et pas chez la page qui filtre.
 *
 * Les deux marcheraient pour le filtrage. Celui-ci est choisi pour deux raisons :
 *
 * 1. La page pose DEUX barres, une par onglet, et la page des emprunts une troisième. Temporiser
 *    chez l'appelant signifierait le refaire trois fois — et une recopie diverge toujours, ce que
 *    l'en-tête de ce fichier raconte déjà pour le formulaire lui-même.
 * 2. Un composant se monte dans un test ; une page de gestion, qui demande une dizaine de points
 *    d'API au montage, non. La temporisation serait livrée sans une seule mesure.
 *
 * Effet de bord utile : la page reçoit une valeur déjà retombée, donc l'écriture de l'adresse
 * qu'elle fait au passage cesse elle aussi de partir à chaque lettre.
 */
const { saisie, appliquer } = useSaisieTemporisee(recherche)

/** La croix rend tout d'un coup : attendre après un clic sur une croix fait douter du clic. */
function effacerLaRecherche() {
  saisie.value = ''
  appliquer()
}

const { t } = useI18n()

const optionsGroupes = computed<OptionGroupe[]>(() =>
  groupesDesObjets(props.objets).map((groupe) => ({ label: groupe.name, value: groupe.id }))
)

const optionsTags = computed<OptionTag[]>(() =>
  tagsDesObjets(props.objets).map((tag) => ({ label: tag.name, value: tag.id, color: tag.color }))
)

const quelqueChoseEstPose = computed(
  () => recherche.value.trim() !== '' || groupes.value.length > 0 || tags.value.length > 0
)

function toutEffacer() {
  // `saisie` d'abord : le composable ramène bien la saisie sur le modèle quand celui-ci change de
  // l'extérieur, mais l'écrire ici évite de dépendre de l'ordre d'exécution de deux watchers pour
  // un geste dont l'utilisateur attend un effet immédiat.
  saisie.value = ''
  recherche.value = ''
  groupes.value = []
  tags.value = []
}
</script>
