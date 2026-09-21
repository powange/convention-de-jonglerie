<template>
  <div>
    <div
      class="group flex items-start gap-2 rounded py-1.5 pr-2 hover:bg-gray-50 dark:hover:bg-gray-900"
      :style="{ paddingLeft: `${profondeur * 1.25}rem` }"
      data-testid="plan-comptable-noeud"
    >
      <!-- Chevron, ou son gabarit vide pour que les codes restent alignés -->
      <UButton
        v-if="aDesEnfants"
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="deplie ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        :aria-label="deplie ? $t('common.collapse') : $t('common.expand')"
        @click="deplie = !deplie"
      />
      <span v-else class="w-6 shrink-0" aria-hidden="true" />

      <!-- Le code et le libellé déplient eux aussi : la flèche seule est une cible trop petite,
           surtout au doigt. Un compte sans sous-compte reste un simple texte — donner un
           curseur de bouton à une ligne qui ne fait rien induit en erreur. -->
      <component
        :is="aDesEnfants ? 'button' : 'div'"
        :type="aDesEnfants ? 'button' : undefined"
        class="flex min-w-0 flex-1 items-start gap-2 text-left"
        :class="aDesEnfants ? 'cursor-pointer' : 'cursor-default'"
        :aria-expanded="aDesEnfants ? deplie : undefined"
        @click="aDesEnfants && (deplie = !deplie)"
      >
        <UBadge color="neutral" variant="subtle" class="mt-0.5 shrink-0 font-mono">
          {{ compte.code }}
        </UBadge>
        <span class="flex min-w-0 flex-1 items-center gap-1.5">
          <span class="text-sm" :class="{ 'font-medium': aDesEnfants }">{{ compte.libelle }}</span>
          <UTooltip v-if="compte.note" :text="compte.note">
            <UIcon
              name="i-lucide-info"
              class="size-4 shrink-0 text-amber-600 dark:text-amber-400"
            />
          </UTooltip>
        </span>
      </component>

      <UBadge v-if="dejaImporte" color="success" variant="subtle" class="mt-0.5 shrink-0">
        {{ $t('gestion.treasury.plan_already_imported') }}
      </UBadge>
      <UButton
        v-else-if="!enEdition"
        size="xs"
        variant="ghost"
        icon="i-lucide-plus"
        class="mt-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        :label="$t('gestion.treasury.plan_import')"
        @click="ouvrirEdition"
      />
    </div>

    <!-- Saisie du libellé avant import : le code est figé, le libellé est à la personne.
         Hors de la zone cliquable ci-dessus, sans quoi écrire dans le champ replierait le
         compte — et un champ dans un bouton n'est pas du HTML valide. -->
    <div
      v-if="enEdition"
      class="flex flex-col gap-2 pb-2 pr-2 sm:flex-row"
      :style="{ paddingLeft: `${profondeur * 1.25 + 2}rem` }"
    >
      <UInput
        v-model="libelleChoisi"
        class="flex-1"
        maxlength="120"
        autofocus
        :placeholder="$t('gestion.treasury.code_label_placeholder')"
        @keydown.enter="confirmer"
        @keydown.esc="enEdition = false"
      />
      <div class="flex gap-2">
        <UButton
          size="sm"
          icon="i-lucide-check"
          :label="$t('gestion.treasury.plan_import')"
          :disabled="!libelleChoisi.trim()"
          @click="confirmer"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          :label="$t('common.cancel')"
          @click="enEdition = false"
        />
      </div>
    </div>

    <template v-if="aDesEnfants && deplie">
      <TreasuryPlanComptableNoeud
        v-for="enfant in compte.enfants"
        :key="enfant.code"
        :compte="enfant"
        :profondeur="profondeur + 1"
        :codes-existants="codesExistants"
        :tout-deplier="toutDeplier"
        @importer="(charge) => emit('importer', charge)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CompteDuPlan } from '~/utils/plans-comptables'

const props = withDefaults(
  defineProps<{
    compte: CompteDuPlan
    codesExistants: string[]
    profondeur?: number
    /** Force le dépliage — utilisé pendant une recherche, où tout doit être visible. */
    toutDeplier?: boolean
  }>(),
  { profondeur: 0, toutDeplier: false }
)

const emit = defineEmits<{
  (e: 'importer', charge: { code: string; libelle: string }): void
}>()

const aDesEnfants = computed(() => (props.compte.enfants?.length ?? 0) > 0)

// Tout est replié au départ : l'arbre complet fait plus de deux cents comptes, et le dérouler
// d'office noierait le niveau qui sert à s'orienter. Une recherche, elle, ouvre tout — c'est le
// rôle de `toutDeplier`.
const deplie = ref(props.toutDeplier)
// Symétrique à dessein : une recherche ouvre tout, l'effacer referme tout. Sans le retour à
// `false`, effacer le filtre laissait l'arbre entièrement déroulé, ce qui contredit le repli
// par défaut — et donne une vue qu'on n'a jamais demandée.
watch(
  () => props.toutDeplier,
  (force) => {
    deplie.value = force
  }
)

const dejaImporte = computed(() => props.codesExistants.includes(props.compte.code))

const enEdition = ref(false)
const libelleChoisi = ref('')

function ouvrirEdition() {
  libelleChoisi.value = props.compte.libelle
  enEdition.value = true
}

function confirmer() {
  const libelle = libelleChoisi.value.trim()
  if (!libelle) return
  emit('importer', { code: props.compte.code, libelle })
  enEdition.value = false
}
</script>
