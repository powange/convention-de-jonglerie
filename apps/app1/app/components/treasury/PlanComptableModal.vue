<template>
  <UModal
    v-model:open="isOpen"
    fullscreen
    :title="$t('gestion.treasury.plan_title')"
    :description="$t('gestion.treasury.plan_description')"
  >
    <template #body>
      <div class="mx-auto flex h-full w-full max-w-4xl flex-col gap-4">
        <div v-if="plans.length > 1" class="flex flex-wrap gap-2">
          <UButton
            v-for="plan in plans"
            :key="plan.id"
            size="sm"
            :color="plan.id === planActifId ? 'primary' : 'neutral'"
            :variant="plan.id === planActifId ? 'solid' : 'subtle'"
            @click="planActifId = plan.id"
          >
            {{ plan.nom }}
          </UButton>
        </div>

        <UAlert
          v-if="planActif?.avertissement"
          icon="i-lucide-info"
          color="info"
          variant="subtle"
          :description="planActif.avertissement"
        />

        <UInput
          v-model="recherche"
          icon="i-lucide-search"
          :placeholder="$t('gestion.treasury.plan_search_placeholder')"
          :trailing="Boolean(recherche)"
          autocomplete="off"
        >
          <template v-if="recherche" #trailing>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              :aria-label="$t('common.clear')"
              @click="recherche = ''"
            />
          </template>
        </UInput>

        <div v-if="chargement" class="space-y-2">
          <USkeleton v-for="n in 6" :key="n" class="h-8 w-full" />
        </div>

        <p
          v-else-if="!racinesFiltrees.length"
          class="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {{ $t('gestion.treasury.plan_no_result') }}
        </p>

        <div v-else class="min-h-0 flex-1 overflow-y-auto pr-1">
          <div v-for="racine in racinesFiltrees" :key="racine.code" class="mb-4">
            <!-- La racine se replie comme n'importe quel compte : replier « 6 — Charges » d'un
                 coup est le geste qui rend la liste des produits atteignable sans dérouler
                 toutes les charges. -->
            <h3
              class="mb-1 border-b border-gray-200 pb-1 dark:border-gray-800"
              :class="racine.note ? 'mb-0' : 'mb-1'"
            >
              <button
                type="button"
                class="flex w-full items-center gap-1.5 py-1 text-left text-sm font-semibold uppercase tracking-wide text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                :aria-expanded="estDepliee(racine.code)"
                @click="basculerRacine(racine.code)"
              >
                <UIcon
                  :name="
                    estDepliee(racine.code) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'
                  "
                  class="size-4 shrink-0"
                />
                {{ racine.code }} — {{ racine.libelle }}
                <span class="ml-auto font-normal normal-case tracking-normal text-gray-400">
                  {{ compterComptes(racine.enfants ?? []) }}
                </span>
              </button>
            </h3>

            <template v-if="estDepliee(racine.code)">
              <p v-if="racine.note" class="mb-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ racine.note }}
              </p>
              <TreasuryPlanComptableNoeud
                v-for="compte in racine.enfants ?? []"
                :key="compte.code"
                :compte="compte"
                :codes-existants="codesExistants"
                :tout-deplier="Boolean(recherche)"
                @importer="importer"
              />
            </template>
          </div>
        </div>

        <p v-if="planActif" class="text-xs text-gray-500 dark:text-gray-400">
          {{ planActif.reference }}
          <ULink
            v-if="planActif.source"
            :to="planActif.source"
            target="_blank"
            rel="noopener"
            class="underline"
          >
            {{ $t('gestion.treasury.plan_source') }}
          </ULink>
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('common.close')"
          @click="isOpen = false"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import {
  chargerPlansComptables,
  compterComptes,
  filtrerComptes,
  type PlanComptable,
} from '~/utils/plans-comptables'

const props = defineProps<{
  open: boolean
  editionId: number
  /** Codes déjà présents dans la convention, pour ne pas proposer deux fois le même. */
  codesExistants: string[]
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'changed'): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const plans = ref<PlanComptable[]>([])
const planActifId = ref<string | null>(null)
const recherche = ref('')
const chargement = ref(false)

const planActif = computed(() => plans.value.find((plan) => plan.id === planActifId.value) ?? null)

/**
 * Le filtre s'applique branche par branche, en gardant les parents des comptes trouvés : un code
 * sorti de son contexte ne permet pas de juger si c'est le bon.
 */
const racinesFiltrees = computed(() => {
  const racines = planActif.value?.racines ?? []
  if (!recherche.value.trim()) return racines

  return racines
    .map((racine) => ({
      ...racine,
      enfants: filtrerComptes(racine.enfants ?? [], recherche.value),
    }))
    .filter((racine) => (racine.enfants?.length ?? 0) > 0)
})

// Chargement différé : les fichiers de plans ne sont demandés qu'à la première ouverture.
watch(
  () => props.open,
  async (ouvert) => {
    if (!ouvert || plans.value.length) return
    chargement.value = true
    try {
      plans.value = await chargerPlansComptables()
      planActifId.value = plans.value[0]?.id ?? null
    } finally {
      chargement.value = false
    }
  },
  { immediate: true }
)

/**
 * Racines dépliées, par plan.
 *
 * Tout part replié : l'arbre complet fait plus de deux cents comptes, et l'ouvrir d'office
 * noierait le niveau qui sert à s'orienter. Une racine nouvellement rencontrée — changement de
 * plan, ou nouveau fichier déposé dans le dossier — arrive donc fermée, comme les autres.
 *
 * Une recherche en cours passe outre : masquer un résultat qu'on vient de trouver serait
 * absurde.
 */
const racinesDepliees = ref(new Set<string>())

const estDepliee = (code: string) =>
  Boolean(recherche.value.trim()) || racinesDepliees.value.has(cleRacine(code))

function cleRacine(code: string) {
  return `${planActifId.value}:${code}`
}

function basculerRacine(code: string) {
  const cle = cleRacine(code)
  // Un nouvel ensemble à chaque fois : muter celui en place ne déclencherait pas le rendu.
  const suivant = new Set(racinesDepliees.value)
  if (suivant.has(cle)) suivant.delete(cle)
  else suivant.add(cle)
  racinesDepliees.value = suivant
}

const codeEnCours = ref<{ code: string; libelle: string } | null>(null)

const { execute: executerImport } = useApiAction(
  () => `/api/editions/${props.editionId}/treasury/codes`,
  {
    method: 'POST',
    body: () => ({ code: codeEnCours.value?.code, label: codeEnCours.value?.libelle }),
    successMessage: { title: t('gestion.treasury.code_created') },
    errorMessages: { default: t('gestion.treasury.code_create_error') },
    onSuccess: () => emit('changed'),
  }
)

async function importer(charge: { code: string; libelle: string }) {
  codeEnCours.value = charge
  await executerImport()
  codeEnCours.value = null
}
</script>
