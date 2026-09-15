<template>
  <div v-if="loading" class="text-center py-8">
    <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 text-gray-400 animate-spin" />
  </div>

  <p v-else-if="!elements.length" class="text-sm text-dimmed py-8 text-center">
    {{ messageVide }}
  </p>

  <!-- Une seule colonne, délibérément : un nom de tarif ou d'option peut être long, et le couper
       en plusieurs colonnes le rendrait illisible. La liste des quotas rattachés s'allonge elle
       aussi — elle a besoin de toute la largeur. -->
  <div v-else class="flex flex-col gap-1 pt-4">
    <div
      v-for="element in elements"
      :key="element.id"
      class="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
    >
      <div class="flex flex-col min-w-0 flex-1">
        <!-- Le logo sur la LIGNE DU TITRE, et non à côté du bloc entier : en frère de la colonne,
             il se centrait verticalement sur tout le contenu, ce qui le décrochait du nom dès que
             le détail occupait plusieurs lignes — le cas d'un champ personnalisé à réponses. -->
        <div class="flex items-center gap-2 min-w-0">
          <!-- D'où vient l'élément, quand l'écran le sait. Il y en a toujours un dans ce cas :
               une place vide se lirait comme une origine inconnue, alors qu'elle voudrait dire
               « créé sur le site ». -->
          <img
            v-if="element.logo"
            :src="element.logo"
            :alt="element.origine ?? ''"
            :title="element.origine ?? ''"
            class="h-5 w-5 object-contain shrink-0"
          />
          <span class="font-medium truncate" :title="element.nom">{{ element.nom }}</span>
        </div>

        <!-- Les quotas déjà rattachés, lisibles sans ouvrir la fenêtre : c'est la question qu'on
             se pose en arrivant sur cet écran.

             En étiquettes et non en texte suivi : on les compte du regard, et deux quotas aux noms
             proches ne se confondent plus. Elles passent à la ligne plutôt que d'être tronquées —
             c'est l'information qu'on vient chercher.

             Un créneau nommé, parce que tous les éléments ne présentent pas leurs quotas de la
             même façon : un champ personnalisé les groupe PAR RÉPONSE, ce que cette rangée plate
             ne saurait pas montrer. Le reste de la ligne — logo, nom, bouton — lui, est commun. -->
        <slot name="detail" :element="element">
          <div v-if="element.quotas.length" class="flex flex-wrap gap-1 mt-1">
            <UBadge
              v-for="quota in element.quotas"
              :key="quota.id"
              color="warning"
              variant="subtle"
            >
              {{ quota.title }}
            </UBadge>
          </div>
          <span v-else class="text-dimmed mt-1">
            {{ $t('gestion.ticketing.assign_quotas_none') }}
          </span>
        </slot>
      </div>

      <UButton
        icon="i-heroicons-pencil"
        color="neutral"
        variant="ghost"
        class="shrink-0"
        :title="libelleEdition"
        @click="emit('editer', element.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * La liste « à quoi ce quota se rattache », partagée par les onglets de la page des quotas.
 *
 * Tarifs et options posent exactement la même question et méritent exactement la même réponse
 * visuelle. Deux copies de ce gabarit auraient fini par diverger — c'est le motif qui revient le
 * plus souvent dans ce dépôt, et celui qu'on cherche à ne plus reproduire.
 *
 * L'appelant fournit une forme neutre : ni tarif ni option, juste un identifiant, un nom, ses
 * quotas, et une provenance quand il en connaît une.
 */
export interface ElementAssociable {
  id: number
  nom: string
  quotas: Array<{ id: number; title: string }>
  /** Chemin du logo de provenance, quand l'écran sait la nommer. */
  logo?: string
  /** Ce que dit l'infobulle du logo. */
  origine?: string | null
}

defineProps<{
  elements: ElementAssociable[]
  loading: boolean
  messageVide: string
  libelleEdition: string
}>()

const emit = defineEmits<{ editer: [id: number] }>()
</script>
