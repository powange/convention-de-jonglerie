<template>
  <UContainer class="space-y-10 py-16">
    <div class="space-y-3 text-center">
      <h1 class="text-3xl font-bold text-balance sm:text-4xl">
        Payez les modules dont vous avez besoin
      </h1>
      <p class="mx-auto max-w-2xl text-muted">
        Un abonnement pour toute votre équipe d'organisation, sans commission sur vos billets. Vos
        bénévoles et vos artistes n'ont jamais rien à payer.
      </p>
      <UBadge
        color="warning"
        variant="subtle"
        icon="i-heroicons-information-circle"
        label="Paiement simulé — aucune carte requise"
      />
      <div class="flex justify-center pt-2">
        <UFieldGroup>
          <UButton
            color="neutral"
            :variant="periode === 'monthly' ? 'solid' : 'outline'"
            label="Mensuel"
            :aria-pressed="periode === 'monthly'"
            @click="periode = 'monthly'"
          />
          <UButton
            color="neutral"
            :variant="periode === 'annual' ? 'solid' : 'outline'"
            label="Annuel · −20 %"
            :aria-pressed="periode === 'annual'"
            @click="periode = 'annual'"
          />
        </UFieldGroup>
      </div>
    </div>

    <!-- Déjà abonné : la formule en cours, et la possibilité d'en changer plus bas. -->
    <UAlert
      v-if="subActive && abonnement"
      class="mx-auto max-w-3xl"
      color="success"
      variant="subtle"
      icon="i-heroicons-check-badge"
      :title="`Votre formule : ${libelleFormuleAbonnement(abonnement.formule, abonnement.plan)}`"
      :description="`${libelleModulesCouverts(abonnement.formule, abonnement.modules)} · active jusqu'au ${formatDate(abonnement.currentPeriodEnd)}. Choisissez une autre formule ci-dessous pour en changer.`"
    />

    <!-- Les trois formules. -->
    <div class="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
      <UCard
        v-for="f in FORMULES"
        :key="f.cle"
        :class="[
          'relative transition',
          f.cle === formuleConseillee
            ? 'ring-2 ring-secondary md:-translate-y-1'
            : f.cle === 'integral'
              ? 'ring-2 ring-primary'
              : '',
        ]"
        :ui="{ body: 'flex h-full flex-col gap-4' }"
      >
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-xl font-semibold">{{ f.libelle }}</h2>
          <UBadge
            v-if="f.cle === formuleConseillee"
            color="secondary"
            variant="subtle"
            label="Votre formule"
          />
          <UBadge
            v-else-if="f.cle === 'integral'"
            color="primary"
            variant="subtle"
            label="Le plus complet"
          />
        </div>
        <p class="text-sm text-muted">{{ f.accroche }}</p>
        <div>
          <p>
            <span class="text-3xl font-bold">{{ euros(prixMensuel(f.cle, periode)) }}</span>
            <span class="text-muted"> /mois</span>
          </p>
          <p class="text-xs text-muted">
            {{
              periode === 'annual' ? `facturé ${euros(f.prix.annual)} par an` : 'sans engagement'
            }}
          </p>
        </div>
        <ul class="flex-1 space-y-2 text-sm">
          <li class="flex items-center gap-2 font-semibold">
            <UIcon name="i-heroicons-check" class="text-success" />
            {{
              f.nombreModules === null
                ? 'Les 6 modules'
                : f.nombreModules === 1
                  ? '1 module au choix'
                  : `${f.nombreModules} modules au choix`
            }}
          </li>
          <li v-if="f.nombreModules === null" class="flex items-center gap-2">
            <UIcon name="i-heroicons-check" class="text-success" /> Les prochains modules inclus
          </li>
          <li class="flex items-center gap-2">
            <UIcon name="i-heroicons-check" class="text-success" /> Carte du site incluse
          </li>
          <li class="flex items-center gap-2">
            <UIcon name="i-heroicons-check" class="text-success" />
            Organisateurs illimités
          </li>
        </ul>
        <UButton
          block
          size="lg"
          :color="f.cle === 'integral' ? 'primary' : 'neutral'"
          :variant="f.cle === 'integral' ? 'solid' : 'subtle'"
          :label="`Choisir ${f.libelle}`"
          :loading="loading && formuleChoisie === f.cle"
          @click="choisir(f.cle)"
        />
      </UCard>
    </div>

    <!-- Le sélecteur : on coche ses besoins, la page désigne la formule. -->
    <UCard class="mx-auto max-w-5xl" variant="subtle">
      <template #header>
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="font-semibold">De quoi avez-vous besoin ?</h2>
          <p class="text-sm text-muted">Cochez vos modules, on vous indique la formule.</p>
        </div>
      </template>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UCheckbox
          v-for="m in MODULES_A_CHOISIR"
          :key="m.cle"
          v-model="besoins[m.cle]"
          :label="m.libelle"
          :description="
            m.cle === 'repas' ? `${m.resume} · va avec Bénévoles ou Artistes` : m.resume
          "
          variant="card"
        />
      </div>
      <template #footer>
        <p v-if="!formuleConseillee" class="text-sm text-muted">Cochez au moins un module.</p>
        <div v-else class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm">
            {{ modulesCoches.length }} module{{ modulesCoches.length > 1 ? 's' : '' }}
            <span v-if="modulesCoches.length >= 3" class="text-muted">
              · à partir de 3 modules, l'Intégral les couvre tous
            </span>
          </p>
          <p class="font-semibold">
            {{ formule(formuleConseillee)?.libelle }} ·
            {{ euros(prixMensuel(formuleConseillee, periode)) }}/mois
          </p>
        </div>
      </template>
    </UCard>

    <div class="mx-auto max-w-5xl space-y-3">
      <p class="text-xs font-semibold tracking-wide text-muted uppercase">
        Dans toutes les formules
      </p>
      <ul class="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="inclus in INCLUS" :key="inclus" class="flex items-center gap-2">
          <UIcon name="i-heroicons-check-circle" class="shrink-0 text-secondary" />
          {{ inclus }}
        </li>
      </ul>
    </div>

    <UAccordion class="mx-auto max-w-5xl" :items="FAQ" />

    <!-- Choix des modules d'une formule Solo ou Duo. -->
    <UModal
      v-model:open="choixOuvert"
      :title="`Formule ${formule(formuleChoisie)?.libelle ?? ''}`"
      :description="
        formule(formuleChoisie)?.nombreModules === 1
          ? 'Choisissez le module compris dans votre formule.'
          : 'Choisissez les 2 modules compris dans votre formule.'
      "
    >
      <template #body>
        <div class="grid gap-3">
          <UCheckbox
            v-for="m in MODULES_A_CHOISIR"
            :key="m.cle"
            :model-value="selection.includes(m.cle)"
            :label="m.libelle"
            :description="m.cle === 'repas' ? 'Va avec Bénévoles ou Artistes' : m.resume"
            :disabled="!selection.includes(m.cle) && selection.length >= nombreAChoisir"
            variant="card"
            @update:model-value="(v) => basculer(m.cle, v === true)"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex w-full flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-muted">{{ selection.length }} / {{ nombreAChoisir }}</p>
          <div class="flex gap-2">
            <UButton color="neutral" variant="ghost" label="Annuler" @click="choixOuvert = false" />
            <UButton
              :label="`Souscrire · ${formuleChoisie ? euros(prixMensuel(formuleChoisie, periode)) : ''}/mois`"
              :disabled="selection.length !== nombreAChoisir"
              :loading="loading"
              @click="execute"
            />
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>

<script setup lang="ts">
/**
 * Page tarifs de Flowvent : trois formules (Solo, Duo, Intégral), au mois ou à l'année, et un
 * sélecteur qui désigne la formule selon les modules cochés. Décisions et maquette : rapport
 * « Tarifs de Flowvent » (26/11/2026). La grille vit dans shared/formules.ts.
 */
import type { CleFormule, ModulePayant, Periode } from '#shared/formules'

import {
  FORMULES,
  MODULES_PAYANTS,
  euros,
  formule,
  formulePourNombreDeModules,
  prixMensuel,
} from '#shared/formules'
import { MODULES_EVENEMENT } from '#shared/modules-evenement'

useSeoMeta({
  title: 'Tarifs — Flowvent',
  description: 'Solo, Duo ou Intégral : payez seulement les modules dont votre événement a besoin.',
})

const { loggedIn } = useUserSession()

// On n'interroge l'API (protégée) que si l'utilisateur est connecté.
const { data: subData, refresh } = await useFetch('/api/subscription/status', {
  immediate: loggedIn.value,
  default: () => ({ active: false, subscription: null }),
})
const subActive = computed(() => !!subData.value?.active)
const abonnement = computed(() => subData.value?.subscription ?? null)

const periode = ref<Periode>(abonnement.value?.plan === 'monthly' ? 'monthly' : 'annual')

/** Les modules payants, avec leur nom et une ligne de description courte. */
const RESUMES: Record<ModulePayant, string> = {
  benevoles: 'Candidatures, équipes, planning',
  artistes: 'Artistes, spectacles, appels',
  repas: 'Repas et leur validation',
  billetterie: 'HelloAsso, contrôle des entrées',
  tresorerie: 'Dépenses, recettes, justificatifs',
  stock: 'Matériel, emplacements, prêts',
}
const MODULES_A_CHOISIR = MODULES_PAYANTS.map((cle) => ({
  cle,
  libelle: MODULES_EVENEMENT.find((m) => m.cle === cle)?.libelle ?? cle,
  resume: RESUMES[cle],
}))

const INCLUS = [
  'Événements illimités',
  'Co-organisateurs illimités, un droit par domaine',
  'Carte du site',
  "Page publique de l'événement",
  'Application installable sur téléphone',
  '0 % de commission sur les billets',
]

const FAQ = [
  {
    label: "Mon événement n'a lieu qu'une fois par an. Que se passe-t-il entre deux éditions ?",
    content:
      "Si votre abonnement s'arrête, rien n'est supprimé : la gestion reste consultable en lecture seule. Vous reprenez là où vous en étiez à la saison suivante.",
  },
  {
    label: 'Puis-je changer de modules en cours de route ?',
    content:
      "Oui, en choisissant une autre formule sur cette page. Un module qui n'est plus compris reste consultable, et désactiver un module ne supprime pas ses données.",
  },
  {
    label: 'Mes co-organisateurs doivent-ils s’abonner ?',
    content:
      "Non. L'abonnement de la personne qui a créé l'événement couvre toute l'équipe d'organisation.",
  },
  {
    label: 'Pourquoi la billetterie est-elle réservée aux associations ?',
    content:
      'Les paiements passent par HelloAsso, qui ne sert que les associations loi 1901. Flowvent ne prend aucune commission sur vos ventes.',
  },
]

// Sélecteur des besoins : prérempli avec la formule en cours.
const besoins = reactive<Record<ModulePayant, boolean>>(
  Object.fromEntries(
    MODULES_PAYANTS.map((cle) => [
      cle,
      abonnement.value?.formule !== 'integral' && !!abonnement.value?.modules?.includes(cle),
    ])
  ) as Record<ModulePayant, boolean>
)
const modulesCoches = computed(() => MODULES_PAYANTS.filter((cle) => besoins[cle]))
const formuleConseillee = computed(() => formulePourNombreDeModules(modulesCoches.value.length))

// Souscription.
const formuleChoisie = ref<CleFormule | null>(null)
const selection = ref<ModulePayant[]>([])
const choixOuvert = ref(false)
const nombreAChoisir = computed(() => formule(formuleChoisie.value)?.nombreModules ?? 0)

function basculer(cle: ModulePayant, coche: boolean) {
  selection.value = coche
    ? [...selection.value, cle].slice(0, nombreAChoisir.value)
    : selection.value.filter((m) => m !== cle)
}

const { execute, loading } = useApiAction('/api/subscription/checkout', {
  method: 'POST',
  body: () => ({
    plan: periode.value,
    formule: formuleChoisie.value,
    modules: formuleChoisie.value === 'integral' ? [] : selection.value,
  }),
  successMessage: {
    title: 'Abonnement activé',
    description: 'Paiement simulé avec succès.',
  },
  errorMessages: { default: "Échec de l'abonnement" },
  onSuccess: async () => {
    choixOuvert.value = false
    await refresh()
    await navigateTo('/dashboard')
  },
})

async function choisir(cle: CleFormule) {
  if (!loggedIn.value) {
    await navigateTo('/register')
    return
  }
  formuleChoisie.value = cle
  const n = formule(cle)?.nombreModules
  if (n === null || n === undefined) {
    await execute()
    return
  }
  // Prérempli par le sélecteur des besoins, à défaut par la formule en cours.
  const depart = modulesCoches.value.length
    ? modulesCoches.value
    : ((abonnement.value?.modules ?? []) as ModulePayant[])
  selection.value = depart.slice(0, n)
  choixOuvert.value = true
}

function formatDate(d?: string | Date | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>
