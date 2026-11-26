<template>
  <UContainer class="space-y-10 py-16">
    <div class="space-y-3 text-center">
      <h1 class="text-3xl font-bold text-balance sm:text-4xl">
        Un prix à la taille de votre événement
      </h1>
      <p class="mx-auto max-w-2xl text-muted">
        Tous les outils de Flowvent dans chaque formule : bénévoles, artistes, repas, billetterie,
        trésorerie, stock et carte du site. Vos bénévoles et vos artistes n'ont jamais rien à payer.
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

    <!-- Code promo : arrivé par un lien (`?code=…`) ou saisi ici ; retenu 30 jours. -->
    <div class="mx-auto max-w-3xl space-y-3">
      <UAlert
        v-if="codeActif && apercu?.valide"
        color="secondary"
        variant="subtle"
        icon="i-heroicons-ticket"
        :title="`Code ${apercu.code} appliqué : ${apercu.resume}`"
        description="Les prix remisés sont affichés sur les formules concernées."
        :actions="[
          { label: 'Retirer le code', color: 'neutral', variant: 'link', onClick: retirerCode },
        ]"
      />
      <UAlert
        v-else-if="codeActif && apercu && !apercu.valide"
        color="warning"
        variant="subtle"
        icon="i-heroicons-exclamation-triangle"
        :title="`Code ${codeActif} : ${apercu.raison}`"
        :actions="[
          { label: 'Retirer le code', color: 'neutral', variant: 'link', onClick: retirerCode },
        ]"
      />
      <div v-else-if="!codeActif" class="flex flex-wrap items-center justify-center gap-2">
        <span class="text-sm text-muted">Vous avez un code ?</span>
        <UInput
          v-model="codeSaisi"
          placeholder="CODE"
          size="sm"
          class="w-40 font-mono"
          aria-label="Code promo"
          @keydown.enter="appliquerCode"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          label="Appliquer"
          :disabled="!codeSaisi"
          @click="appliquerCode"
        />
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
      :description="`Active jusqu'au ${formatDate(abonnement.currentPeriodEnd)}. Choisissez une autre formule ci-dessous pour en changer.`"
    />

    <!-- Les trois formules payantes. -->
    <div class="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
      <UCard
        v-for="f in FORMULES_PAYANTES"
        :key="f.cle"
        :class="[
          'relative transition',
          f.cle === formuleConseillee
            ? 'ring-2 ring-secondary md:-translate-y-1'
            : f.cle === FORMULE_MISE_EN_AVANT
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
            label="Pour vous"
          />
          <UBadge
            v-else-if="subActive && abonnement?.formule === f.cle"
            color="success"
            variant="subtle"
            label="Votre formule"
          />
          <UBadge
            v-else-if="f.cle === FORMULE_MISE_EN_AVANT"
            color="primary"
            variant="subtle"
            label="Le plus choisi"
          />
        </div>
        <p class="text-sm text-muted">{{ f.accroche }}</p>
        <div>
          <p v-if="prixAvecCode(f.cle) !== null">
            <s class="mr-1 text-muted">{{ euros(prixMensuel(f.cle, periode)) }}</s>
            <span class="text-3xl font-bold">
              {{
                prixAvecCode(f.cle) === 0
                  ? 'Offert'
                  : euros(
                      periode === 'annual'
                        ? Math.round(prixAvecCode(f.cle)! / 12)
                        : prixAvecCode(f.cle)!
                    )
              }}
            </span>
            <span v-if="prixAvecCode(f.cle) !== 0" class="text-muted"> /mois</span>
          </p>
          <p v-else>
            <span class="text-3xl font-bold">{{ euros(prixMensuel(f.cle, periode)) }}</span>
            <span class="text-muted"> /mois</span>
          </p>
          <p class="text-xs text-muted">
            <template v-if="prixAvecCode(f.cle) !== null">
              {{ apercu?.valide ? apercu.resume : '' }}
              <template v-if="periode === 'annual' && prixAvecCode(f.cle)! > 0">
                · facturé {{ euros(prixAvecCode(f.cle)!) }} par an
              </template>
            </template>
            <template v-else>
              {{
                periode === 'annual' ? `facturé ${euros(f.prix.annual)} par an` : 'sans engagement'
              }}
              <span v-if="codeActif && apercu?.valide"> · code non valable sur cette formule</span>
            </template>
          </p>
        </div>
        <ul class="flex-1 divide-y divide-default text-sm">
          <li
            v-for="c in COMPTEURS"
            :key="c.cle"
            class="flex items-baseline justify-between gap-3 py-1.5"
          >
            <span class="text-muted">{{ libelleCompteur(c.cle) }}</span>
            <span class="font-semibold tabular-nums">{{ libellePlafond(f.plafonds[c.cle]) }}</span>
          </li>
        </ul>
        <UButton
          block
          size="lg"
          :color="f.cle === FORMULE_MISE_EN_AVANT ? 'primary' : 'neutral'"
          :variant="f.cle === FORMULE_MISE_EN_AVANT ? 'solid' : 'subtle'"
          :label="`Choisir ${f.libelle}`"
          :loading="loading && formuleChoisie === f.cle"
          @click="choisir(f.cle)"
        />
      </UCard>
    </div>

    <!-- La formule gratuite : celle de tout compte sans abonnement payant. -->
    <UCard class="mx-auto max-w-5xl" variant="subtle">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="space-y-1">
          <p class="font-semibold">
            {{ gratuite.libelle }}, gratuite
            <UBadge
              v-if="loggedIn && !subActive"
              class="ml-2"
              color="success"
              variant="subtle"
              label="Votre formule"
            />
          </p>
          <p class="text-sm text-muted">
            {{ gratuite.accroche }} {{ libellePlafondsFormule(gratuite.cle) }}, tous les modules
            compris.
          </p>
        </div>
        <UButton
          v-if="!loggedIn"
          to="/register"
          color="neutral"
          variant="outline"
          label="Créer un compte"
          class="shrink-0"
        />
      </div>
    </UCard>

    <!-- Le calculateur : on indique la taille de son événement, la page désigne la formule. -->
    <UCard class="mx-auto max-w-5xl" variant="subtle">
      <template #header>
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="font-semibold">Quelle taille fait votre événement ?</h2>
          <p class="text-sm text-muted">On vous indique la formule.</p>
        </div>
      </template>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField v-for="c in COMPTEURS" :key="c.cle" :label="libelleCompteur(c.cle)">
          <UInputNumber v-model="besoins[c.cle]" :min="0" :max="5000" class="w-full" />
        </UFormField>
      </div>
      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-muted">
            {{
              tientEnGratuite
                ? 'Tout tient dans la formule gratuite.'
                : formuleConseillee
                  ? 'Les candidatures ne comptent pas : seulement les bénévoles que vous acceptez.'
                  : 'Au-delà du Grand festival : écrivez-nous pour une formule sur devis.'
            }}
          </p>
          <p class="font-semibold">
            <template v-if="tientEnGratuite">{{ gratuite.libelle }} · gratuite</template>
            <template v-else-if="formuleConseillee">
              {{ formule(formuleConseillee)?.libelle }} ·
              {{ euros(prixMensuel(formuleConseillee, periode)) }}/mois
            </template>
            <template v-else>Sur devis</template>
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

    <!-- Un code de l'abonnement en cours serait perdu : on le dit avant de souscrire. -->
    <UModal
      v-model:open="confirmationOuverte"
      :title="`Formule ${formule(formuleChoisie)?.libelle ?? ''}`"
      description="Confirmez votre changement de formule."
    >
      <template #body>
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :title="`Votre code ${codePerdu} ne vaut pas pour cette formule`"
          description="En la choisissant, vous perdez sa remise."
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Annuler"
            @click="confirmationOuverte = false"
          />
          <UButton :label="libelleSouscrire" :loading="loading" @click="execute" />
        </div>
      </template>
    </UModal>
  </UContainer>
</template>

<script setup lang="ts">
/**
 * Page tarifs de Flowvent : trois formules payantes à la TAILLE (Association, Festival, Grand
 * festival), la formule gratuite, et un calculateur qui désigne la formule selon la taille de
 * l'événement. Tous les modules sont compris partout. Décisions et maquette : rapport « Tarifs de
 * Flowvent », version 2 (26/11/2026). La grille vit dans shared/formules.ts.
 */
import type { CleFormulePayante, Compteur, Periode } from '#shared/formules'

import { couvre, normaliserCode } from '#shared/codes-promo'
import {
  COMPTEURS,
  FORMULES_PAYANTES,
  FORMULE_GRATUITE,
  euros,
  formule,
  formulePourTaille,
  libellePlafond,
  prixMensuel,
} from '#shared/formules'

useSeoMeta({
  title: 'Tarifs — Flowvent',
  description:
    'Un prix à la taille de votre événement, tous les modules compris : bénévoles, artistes, repas, billetterie, trésorerie, stock.',
})

const FORMULE_MISE_EN_AVANT: CleFormulePayante = 'festival'
const gratuite = formule(FORMULE_GRATUITE)!

const { loggedIn } = useUserSession()

// On n'interroge l'API (protégée) que si l'utilisateur est connecté.
const { data: subData, refresh } = await useFetch('/api/subscription/status', {
  immediate: loggedIn.value,
  default: () => ({ active: false, subscription: null }),
})
const subActive = computed(() => !!subData.value?.active)
const abonnement = computed(() => subData.value?.subscription ?? null)

const periode = ref<Periode>(abonnement.value?.plan === 'monthly' ? 'monthly' : 'annual')

// Code promo : arrivé par le lien `/pricing?code=…`, ou saisi. Retenu dans un cookie pendant
// 30 jours, pour survivre à la création du compte. Le paiement le revérifie toujours.
const route = useRoute()
const codeCookie = useCookie<string | null>('flowvent_code_promo', {
  maxAge: 60 * 60 * 24 * 30,
  sameSite: 'lax',
})
if (typeof route.query.code === 'string' && normaliserCode(route.query.code)) {
  codeCookie.value = normaliserCode(route.query.code)
}
const codeActif = computed(() => normaliserCode(codeCookie.value))
const codeSaisi = ref('')

type Apercu =
  | { valide: false; raison: string }
  | {
      valide: true
      code: string
      resume: string
      advantage: string
      prix: Record<string, Record<string, number | null>>
    }
const recuperer = useRequestFetch()
const { data: apercu } = await useAsyncData<Apercu | null>(
  'apercu-code-promo',
  () =>
    codeActif.value
      ? recuperer<Apercu>(`/api/codes-promo/${encodeURIComponent(codeActif.value)}`)
      : Promise.resolve(null),
  { watch: [codeActif] }
)

/** Le prix remisé de la période facturée (centimes), ou `null` si aucun code ne vaut ici. */
function prixAvecCode(cle: CleFormulePayante): number | null {
  const a = apercu.value
  return a?.valide ? (a.prix[cle]?.[periode.value] ?? null) : null
}

function appliquerCode() {
  const code = normaliserCode(codeSaisi.value)
  if (code) codeCookie.value = code
  codeSaisi.value = ''
}
function retirerCode() {
  codeCookie.value = null
}

/** « Bénévoles par événement », « Événements en cours ». */
function libelleCompteur(cle: Compteur) {
  const c = COMPTEURS.find((x) => x.cle === cle)!
  return c.parEvenement ? `${c.libelle} par événement` : c.libelle
}

const INCLUS = [
  'Tous les modules, et ceux à venir',
  'Candidatures illimitées',
  'Un droit par domaine pour chaque co-organisateur',
  "Page publique de l'événement",
  'Application installable sur téléphone',
  '0 % de commission sur les billets',
]

const FAQ = [
  {
    label: 'Que se passe-t-il si je dépasse ma formule ?',
    content:
      'Une marge de 10 % vous laisse finir sereinement, puis les nouveaux ajouts demandent la formule supérieure. Rien de ce qui existe n’est retiré ni bloqué : vous continuez à planifier, nourrir et payer tout le monde.',
  },
  {
    label: 'Les candidats comptent-ils ?',
    content:
      'Non. Seuls les bénévoles que vous acceptez et les artistes que vous ajoutez à l’événement comptent. Recevez autant de candidatures que vous voulez.',
  },
  {
    label: 'Mon événement est passé. Compte-t-il encore ?',
    content:
      'Archivez-le depuis ses informations : il reste consultable en lecture seule, et libère sa place pour l’édition suivante.',
  },
  {
    label: 'Et si mon abonnement s’arrête ?',
    content:
      'Vous revenez à la formule gratuite. Rien n’est supprimé ; si vous avez plus d’événements en cours qu’elle n’en comprend, leur gestion passe en lecture seule jusqu’à ce que vous en archiviez.',
  },
  {
    label: 'Mes co-organisateurs doivent-ils s’abonner ?',
    content:
      'Non. L’abonnement de la personne qui a créé l’événement couvre toute l’équipe d’organisation, dans la limite de sa formule.',
  },
  {
    label: 'Pourquoi la billetterie est-elle réservée aux associations ?',
    content:
      'Les paiements passent par HelloAsso, qui ne sert que les associations loi 1901. Flowvent ne prend aucune commission sur vos ventes.',
  },
]

// Calculateur : prérempli avec un festival moyen.
const besoins = reactive<Record<Compteur, number>>({
  evenements: 1,
  benevoles: 60,
  artistes: 10,
  organisateurs: 3,
})
const tientEnGratuite = computed(() =>
  COMPTEURS.every((c) => {
    const p = gratuite.plafonds[c.cle]
    return p === null || (besoins[c.cle] ?? 0) <= p
  })
)
const formuleConseillee = computed(() =>
  tientEnGratuite.value ? null : formulePourTaille({ ...besoins })
)

// Souscription.
const formuleChoisie = ref<CleFormulePayante | null>(null)
const confirmationOuverte = ref(false)

/**
 * Le code de l'abonnement en cours, si la formule choisie le ferait perdre — et qu'aucun autre code
 * valable ne le remplace. Le serveur le reprend d'office quand il couvre la formule
 * (server/utils/codes-promo.ts) ; on prévient seulement quand ce n'est pas le cas.
 */
const codePerdu = computed(() => {
  const enCours = abonnement.value?.codePromo
  const cle = formuleChoisie.value
  if (!enCours || !cle) return null
  if (prixAvecCode(cle) !== null) return null
  const courtEncore =
    enCours.duration === 'forever' ||
    (!!enCours.advantageEndsAt && new Date(enCours.advantageEndsAt) > new Date())
  if (!courtEncore) return null
  return couvre(enCours, cle, periode.value) ? null : enCours.code
})

const libelleSouscrire = computed(() => {
  const cle = formuleChoisie.value
  if (!cle) return 'Souscrire'
  const remise = prixAvecCode(cle)
  if (remise === 0) return 'Souscrire · offert'
  const parMois =
    remise === null
      ? prixMensuel(cle, periode.value)
      : periode.value === 'annual'
        ? Math.round(remise / 12)
        : remise
  return `Souscrire · ${euros(parMois)}/mois`
})

const { execute, loading } = useApiAction('/api/subscription/checkout', {
  method: 'POST',
  body: () => ({
    plan: periode.value,
    formule: formuleChoisie.value,
    code: apercu.value?.valide ? codeActif.value : null,
  }),
  successMessage: {
    title: 'Abonnement activé',
    description: 'Paiement simulé avec succès.',
  },
  errorMessages: { default: "Échec de l'abonnement" },
  onSuccess: async () => {
    confirmationOuverte.value = false
    // Le code a servi : il ne doit plus s'afficher ni se représenter.
    codeCookie.value = null
    await refresh()
    await navigateTo('/dashboard')
  },
})

async function choisir(cle: CleFormulePayante) {
  if (!loggedIn.value) {
    await navigateTo('/register')
    return
  }
  formuleChoisie.value = cle
  if (codePerdu.value) {
    confirmationOuverte.value = true
    return
  }
  await execute()
}

function formatDate(d?: string | Date | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>
