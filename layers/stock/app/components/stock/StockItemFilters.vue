<!--
  Les trois filtres de la liste du matériel, écrits une seule fois.

  Ils servent à deux dispositions : en ligne sur écran large, empilés dans une modale sur écran
  étroit, où trois champs côte à côte ne tiennent pas. Les dupliquer aurait garanti qu'une
  correction n'atteigne qu'une des deux.

  La disposition vient du parent, par les classes qu'il pose sur ce composant : lui seul sait s'il
  affiche une ligne ou une colonne.

  ⚠️ PAS DE `help` SUR CES CHAMPS, et c'est délibéré. Un `UFormField :help` sous le nom et sous le
  lieu rendait ces deux champs plus hauts que les deux listes déroulantes voisines, et la rangée
  est alignée par le BAS : les deux saisies remontaient donc au-dessus des deux autres. Passer la
  rangée en `items-start` ne réglait rien — « Lieu de récupération ou de retour » tient sur deux
  lignes là où « Nom de l'objet » en tient une, si bien que les saisies se décalaient de vingt
  pixels dans l'autre sens. Mesuré par un test Playwright, pas supposé.

  L'aide est donc rendue par le PARENT, en une ligne sous la barre : elle ne touche à aucun
  alignement et dit la même chose une fois pour les deux champs.
-->
<template>
  <div>
    <UFormField :label="$t('gestion.stock.item_name')" class="flex-1 min-w-0">
      <UInput
        v-model="saisieNom"
        icon="i-heroicons-magnifying-glass"
        :placeholder="$t('gestion.stock.name_filter_placeholder')"
        class="w-full"
        @keydown.enter="appliquerNom"
      >
        <template v-if="saisieNom" #trailing>
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            icon="i-heroicons-x-mark"
            :aria-label="$t('common.clear')"
            @click="effacerNom"
          />
        </template>
      </UInput>
    </UFormField>

    <UFormField :label="$t('gestion.stock.tags.filter_label')" class="flex-1 min-w-0">
      <USelectMenu
        v-model="tags"
        :items="tagItems"
        multiple
        :placeholder="$t('gestion.stock.tags.filter_placeholder')"
        searchable
        :searchable-placeholder="$t('common.search')"
        class="w-full"
        :ui="{ content: 'min-w-fit' }"
      >
        <template #default="{ modelValue: selected }">
          <span v-if="!selected?.length" class="text-gray-400">
            {{ $t('gestion.stock.tags.filter_placeholder') }}
          </span>
          <div v-else class="flex flex-wrap gap-1">
            <StockTagBadge
              v-for="tg in selected"
              :key="tg.value"
              :tag="{ name: tg.label, color: tg.color }"
            />
          </div>
        </template>
        <template #item-leading="{ item: option }">
          <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: option.color }" />
        </template>
      </USelectMenu>
    </UFormField>

    <UFormField :label="$t('gestion.stock.external_loan')" class="flex-1 min-w-0">
      <USelectMenu
        v-model="etats"
        :items="etatsItems"
        multiple
        :placeholder="$t('gestion.stock.tags.filter_placeholder')"
        class="w-full"
        :ui="{ content: 'min-w-fit' }"
      />
    </UFormField>

    <UFormField :label="$t('gestion.stock.loan_place_filter')" class="flex-1 min-w-0">
      <UInput
        v-model="saisieLieu"
        icon="i-heroicons-magnifying-glass"
        :placeholder="$t('gestion.stock.loan_place_filter_placeholder')"
        class="w-full"
        @keydown.enter="appliquerLieu"
      >
        <template v-if="saisieLieu" #trailing>
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            icon="i-heroicons-x-mark"
            :aria-label="$t('common.clear')"
            @click="effacerLieu"
          />
        </template>
      </UInput>
    </UFormField>
  </div>
</template>

<script setup lang="ts">
// Composable de l'application, pas de ce layer : la trésorerie et les artistes s'en servent aussi.
import { useSaisieTemporisee } from '#imports'

interface OptionTag {
  label: string
  value: number
  color: string
}
interface OptionEtat {
  label: string
  value: string
}

defineProps<{
  tagItems: OptionTag[]
  etatsItems: OptionEtat[]
}>()

const nom = defineModel<string>('nom', { required: true })
const tags = defineModel<OptionTag[]>('tags', { required: true })
const etats = defineModel<OptionEtat[]>('etats', { required: true })
const lieu = defineModel<string>('lieu', { required: true })

/*
 * ⚠️ DEUX TEMPORISATIONS SÉPARÉES, une par champ, et non une pour les deux.
 *
 * Les deux filtres se composent en ET : chercher « marmite » puis « cuisine » resserre le
 * résultat. Les faire partager un minuteur ferait que taper dans l'un repousserait l'écriture de
 * l'autre — on tape le lieu, la liste ne bouge pas, et c'est le nom saisi trente secondes plus tôt
 * qu'on croirait fautif.
 *
 * La saisie reste immédiate à l'écran dans les deux cas : c'est le filtrage, chez le parent, qui
 * attend. Ce parent écrit aussi l'adresse à chaque changement — un `replace` d'adresse par lettre
 * jusqu'ici, qu'il cesse de faire sans qu'on ait eu à le modifier.
 */
const { saisie: saisieNom, appliquer: appliquerNom } = useSaisieTemporisee(nom)
const { saisie: saisieLieu, appliquer: appliquerLieu } = useSaisieTemporisee(lieu)

/** La croix rend tout d'un coup : attendre après un clic sur une croix fait douter du clic. */
function effacerNom() {
  saisieNom.value = ''
  appliquerNom()
}

function effacerLieu() {
  saisieLieu.value = ''
  appliquerLieu()
}
</script>
