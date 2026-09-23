<!--
  Les comptes qui semblent appartenir à une même personne.

  `email` et `pseudo` étant uniques en base, il n'existe pas de doublon EXACT à chercher : cet
  écran montre des rapprochements, et c'est pourquoi chaque grappe affiche SON MOTIF. C'est le
  motif qui permet de juger d'un coup d'œil — deux adresses menant à la même boîte ne se discutent
  pas, deux homonymes si.

  Elle constate et ne décide rien : la fusion reste une action que l'administrateur déclenche, avec
  la modale qui existe déjà pour cela.
-->
<template>
  <UModal v-model:open="ouverte" fullscreen :title="$t('admin.duplicates.title')">
    <template #body>
      <div class="space-y-6">
        <div v-if="enCours" class="flex items-center gap-3 text-gray-500">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin h-5 w-5" />
          <span>{{ $t('admin.duplicates.searching') }}</span>
        </div>

        <template v-else>
          <!-- Ce qui donne son sens au nombre de grappes : sur combien de comptes. -->
          <UAlert
            :icon="grappes.length ? 'i-heroicons-information-circle' : 'i-heroicons-check-circle'"
            :color="grappes.length ? 'primary' : 'success'"
            variant="subtle"
            :title="
              grappes.length
                ? $t('admin.duplicates.summary', {
                    grappes: grappes.length,
                    comptes: comptesExamines,
                  })
                : $t('admin.duplicates.none', { comptes: comptesExamines })
            "
            :description="grappes.length ? $t('admin.duplicates.summary_help') : undefined"
          />

          <div
            v-for="grappe in grappes"
            :key="`${grappe.motif}-${grappe.cle}`"
            class="border rounded-lg p-4"
            :class="
              grappe.suspecte
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20'
                : 'border-gray-200 dark:border-gray-700'
            "
          >
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <UBadge :color="couleurDuMotif(grappe.motif)" variant="subtle">
                {{ $t(`admin.duplicates.motif.${grappe.motif}`) }}
              </UBadge>
              <span class="font-mono text-sm text-gray-700 dark:text-gray-300 break-all">
                {{ grappe.cle }}
              </span>
              <UBadge color="neutral" variant="outline" size="sm">
                {{ $t('admin.duplicates.accounts_count', { count: grappe.comptes.length }) }}
              </UBadge>
            </div>

            <!--
              Une grappe trop nombreuse n'est pas cachée : la taire ferait disparaître un fait.
              Elle est expliquée — c'est presque toujours une valeur de remplissage.
            -->
            <p
              v-if="grappe.suspecte"
              class="text-sm text-amber-700 dark:text-amber-400 mb-3 flex items-start gap-2"
            >
              <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 mt-0.5 shrink-0" />
              <span>{{ $t('admin.duplicates.suspicious_cluster') }}</span>
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <div
                v-for="compte in comptesDe(grappe)"
                :key="compte.id"
                class="flex items-start justify-between gap-3 p-3 rounded bg-gray-50 dark:bg-gray-800"
              >
                <div class="min-w-0 space-y-1">
                  <p class="font-medium text-sm truncate">{{ compte.pseudo }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400 break-all">
                    {{ compte.email }}
                  </p>
                  <p
                    v-if="compte.prenom || compte.nom"
                    class="text-xs text-gray-500 dark:text-gray-500 truncate"
                  >
                    {{ [compte.prenom, compte.nom].filter(Boolean).join(' ') }}
                  </p>
                  <p class="text-xs text-gray-400">
                    {{
                      $t('admin.duplicates.registered_on', { date: formatDate(compte.createdAt) })
                    }}
                  </p>
                </div>

                <div class="flex flex-col gap-1 shrink-0">
                  <UTooltip :text="$t('admin.duplicates.open_profile')">
                    <UButton
                      :to="`/admin/users/${compte.id}`"
                      icon="i-heroicons-arrow-top-right-on-square"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :aria-label="$t('admin.duplicates.open_profile')"
                    />
                  </UTooltip>
                  <UTooltip :text="$t('admin.merge_user_accounts')">
                    <UButton
                      icon="i-heroicons-arrows-pointing-in"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :aria-label="$t('admin.merge_user_accounts')"
                      @click="emit('merge', compte)"
                    />
                  </UTooltip>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { GrappeDeDoublons, MotifDeRapprochement } from '~~/shared/utils/doublons-utilisateurs'

interface CompteDouble {
  id: number
  email: string
  pseudo: string
  nom?: string | null
  prenom?: string | null
  phone?: string | null
  createdAt: string
}

const ouverte = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  (e: 'merge', compte: CompteDouble): void
}>()

const { t } = useI18n()
const toast = useToast()
const { formatDate } = useDateFormat()

const enCours = ref(false)
const grappes = ref<GrappeDeDoublons[]>([])
const comptes = ref<CompteDouble[]>([])
const comptesExamines = ref(0)

const parId = computed(() => new Map(comptes.value.map((c) => [c.id, c])))

function comptesDe(grappe: GrappeDeDoublons): CompteDouble[] {
  return grappe.comptes.map((id) => parId.value.get(id)).filter(Boolean) as CompteDouble[]
}

/** Du plus sûr au plus bavard : la couleur dit la confiance qu'on peut accorder au motif. */
function couleurDuMotif(motif: MotifDeRapprochement) {
  return { boite: 'success', identite: 'primary', telephone: 'warning', pseudo: 'neutral' }[
    motif
  ] as 'success' | 'primary' | 'warning' | 'neutral'
}

async function chercher() {
  enCours.value = true
  try {
    const reponse = await $fetch<{
      grappes: GrappeDeDoublons[]
      comptes: CompteDouble[]
      comptesExamines: number
    }>('/api/admin/users/doublons')
    grappes.value = reponse.grappes
    comptes.value = reponse.comptes
    comptesExamines.value = reponse.comptesExamines
  } catch {
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('admin.duplicates.search_error'),
    })
    ouverte.value = false
  } finally {
    enCours.value = false
  }
}

/*
 * La recherche part à l'OUVERTURE, et non au montage : la modale est montée avec la page, et
 * parcourir tout le fichier des comptes pour un écran que personne n'a demandé serait payer
 * cher un résultat que personne ne regarde.
 */
watch(ouverte, (estOuverte) => {
  if (estOuverte) chercher()
})
</script>
