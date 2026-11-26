<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <ManagementPageHeader
      titre="Organisateurs"
      description="L'équipe qui gère l'événement avec vous, et ce que chacun peut faire."
      module="organizers"
    />

    <UAlert
      v-if="erreur"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      title="Événement introuvable, ou vous n'y avez pas accès."
    />
    <USkeleton v-else-if="!liste" class="h-64 w-full" />

    <template v-else>
      <!-- Lien d'invitation à transmettre : Flowvent n'envoie pas de courriel. -->
      <UAlert
        v-if="lienAfficher"
        color="info"
        variant="soft"
        icon="i-heroicons-link"
        title="Lien d'activation à transmettre"
        :description="`Envoyez ce lien à ${lienAfficher.pour} (valable 7 jours) : il y choisira son mot de passe, puis retrouvera l'événement dans son tableau de bord.`"
        :close="true"
        @update:open="lienAfficher = null"
      >
        <template #actions>
          <div class="flex w-full gap-2">
            <UInput :model-value="lienAfficher.lien" readonly class="flex-1" />
            <UButton icon="i-heroicons-clipboard-document" label="Copier" @click="copier" />
          </div>
        </template>
      </UAlert>

      <UCard>
        <template #header>
          <p class="font-semibold">Équipe d'organisation</p>
        </template>
        <ul class="divide-y divide-default">
          <li class="flex flex-wrap items-center gap-3 py-3">
            <UiUserAvatar :user="liste.proprietaire" size="md" />
            <!-- `min-w-48` : sur un téléphone, le badge passe dessous plutôt que d'écraser le nom. -->
            <div class="min-w-48 flex-1">
              <p class="font-medium break-words">{{ nom(liste.proprietaire) }}</p>
              <p v-if="liste.proprietaire.email" class="truncate text-sm text-muted">
                {{ liste.proprietaire.email }}
              </p>
            </div>
            <UBadge
              color="primary"
              variant="subtle"
              label="Propriétaire · tous les droits"
              class="ml-13 sm:ml-0"
            />
          </li>

          <li v-for="o in liste.organisateurs" :key="o.id" class="flex flex-col gap-3 py-3">
            <!-- Nom et actions sur une ligne, droits sur la suivante : le nom ne se tronque plus quand
                 la liste des droits s'allonge avec les modules. -->
            <div class="flex items-center gap-3">
              <UiUserAvatar :user="o.compte" size="md" />
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-center gap-x-2 font-medium">
                  <span class="break-words">{{ nom(o.compte) }}</span>
                  <UBadge
                    v-if="o.compte.enAttente"
                    color="warning"
                    variant="subtle"
                    size="sm"
                    label="Invitation en attente"
                    class="shrink-0"
                  />
                </p>
                <p v-if="o.compte.email" class="truncate text-sm text-muted">
                  {{ o.compte.email }}
                </p>
              </div>
              <div v-if="liste.peutGerer || repasOuverts" class="flex gap-1">
                <!-- Repas de l'organisateur (module repas, droit dédié) — la modale vient du layer. -->
                <UTooltip v-if="repasOuverts" text="Repas">
                  <UButton
                    icon="i-lucide-utensils"
                    color="neutral"
                    variant="ghost"
                    aria-label="Repas"
                    @click="ouvrirRepas(o)"
                  />
                </UTooltip>
                <UTooltip
                  v-if="liste.peutGerer && o.compte.enAttente"
                  text="Nouveau lien d'activation"
                >
                  <UButton
                    icon="i-heroicons-link"
                    color="neutral"
                    variant="ghost"
                    aria-label="Nouveau lien d'activation"
                    :loading="lienEnCours === o.id"
                    @click="nouveauLien(o.id, nom(o.compte))"
                  />
                </UTooltip>
                <UTooltip v-if="liste.peutGerer" text="Retirer de l'équipe">
                  <UButton
                    icon="i-heroicons-user-minus"
                    color="error"
                    variant="ghost"
                    aria-label="Retirer de l'équipe"
                    @click="retirer(o)"
                  />
                </UTooltip>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 sm:pl-13">
              <USwitch
                v-for="d in DROITS"
                :key="d.cle"
                :model-value="o.droits[d.cle]"
                :label="d.libelle"
                :disabled="!liste.peutGerer || droitEnCours === o.id"
                @update:model-value="(v: boolean) => changerDroit(o.id, d.cle, v)"
              />
            </div>
          </li>
          <li v-if="!liste.organisateurs.length" class="py-4 text-sm text-muted">
            Aucun co-organisateur pour l'instant.
          </li>
        </ul>
      </UCard>

      <UCard v-if="liste.peutGerer">
        <template #header>
          <p class="font-semibold">Ajouter un organisateur</p>
          <p class="text-sm text-muted">
            Un compte Flowvent existant, par son adresse e-mail ou son pseudo. Pas encore de compte
            ? Indiquez son adresse : vous pourrez l'inviter.
          </p>
        </template>
        <UForm :state="ajout" class="space-y-4" @submit="ajouter">
          <UFormField label="Adresse e-mail ou pseudo" name="identifiant" required>
            <UInput
              v-model="ajout.identifiant"
              class="w-full"
              placeholder="prenom@exemple.fr ou pseudo"
              @update:model-value="inviter = false"
            />
          </UFormField>

          <div v-if="inviter" class="grid gap-4 sm:grid-cols-2">
            <UAlert
              class="sm:col-span-2"
              color="warning"
              variant="soft"
              icon="i-heroicons-envelope"
              title="Aucun compte avec cette adresse"
              description="Indiquez son prénom et son nom : un compte sera créé, et vous recevrez un lien d'activation à lui transmettre."
            />
            <UFormField label="Prénom" name="prenom" required>
              <UInput v-model="ajout.prenom" class="w-full" />
            </UFormField>
            <UFormField label="Nom" name="nom" required>
              <UInput v-model="ajout.nom" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Droits">
            <div class="flex flex-wrap gap-4">
              <UCheckbox
                v-for="d in DROITS"
                :key="d.cle"
                v-model="ajout.droits[d.cle]"
                :label="d.libelle"
                :description="d.description"
              />
            </div>
          </UFormField>

          <div class="flex justify-end">
            <UButton
              type="submit"
              :icon="inviter ? 'i-heroicons-envelope' : 'i-heroicons-user-plus'"
              :label="inviter ? 'Inviter' : 'Ajouter'"
              :loading="ajoutEnCours"
              :disabled="!ajout.identifiant.trim() || (inviter && (!ajout.prenom || !ajout.nom))"
            />
          </div>
        </UForm>
      </UCard>
    </template>

    <OrganizersMealsModal
      v-model="repasOuvert"
      :organizer="organisateurDesRepas"
      :edition-id="editionId"
    />

    <UiConfirmationDemandee :confirmation="confirmation" />
  </div>
</template>

<script setup lang="ts">
/**
 * Les organisateurs d'un événement Flowvent et leurs droits par domaine (décision de
 * l'utilisateur) : modifier l'événement, gérer les organisateurs, puis un droit par module porté
 * (cf. shared/modules-evenement.ts). Le propriétaire a tout, et seul lui supprime l'événement.
 *
 * Ajout : un compte existant (e-mail ou pseudo), ou une invitation par adresse — l'invitation ne
 * part pas encore par courriel : le lien d'activation est affiché ici, à transmettre soi-même.
 */
import type { CleDroit } from '#shared/modules-evenement'

import { droitsProposes } from '#shared/modules-evenement'

definePageMeta({ middleware: ['subscription'] })

type Cle = CleDroit
interface Compte {
  id: number
  pseudo: string
  prenom: string | null
  nom: string | null
  email?: string
  emailHash: string | null
  profilePicture: string | null
  updatedAt: string
  enAttente: boolean
}
interface Liste {
  peutGerer: boolean
  proprietaire: Compte
  organisateurs: { id: number; compte: Compte; droits: Record<Cle, boolean> }[]
}

// Les droits proposés : ceux de l'événement et ceux des modules portés (shared/modules-evenement).
const DROITS = droitsProposes()

/** Un nouvel organisateur : les bénévoles seulement, comme avant l'arrivée des autres modules. */
function droitsParDefaut(): Record<Cle, boolean> {
  return Object.fromEntries(DROITS.map((d) => [d.cle, d.cle === 'benevoles'])) as Record<
    Cle,
    boolean
  >
}

const route = useRoute()
const refEvenement = String(route.params.id)
const base = `/api/events/${refEvenement}/organizers`
const toast = useToast()
const confirmation = useConfirmation()

const { data: liste, error: erreur, refresh } = await useFetch<Liste>(base)

const nom = (c: Compte) => [c.prenom, c.nom].filter(Boolean).join(' ') || c.pseudo

// ── Repas d'un organisateur (module repas) ─────────────────────────────────────────────────
// Mêmes droits et modules que la barre latérale (clé partagée) : module activé ET droit `repas`.
const editionId = useEditionIdRef()
const { data: acces } = useFetch<{ modules: { repas?: boolean }; droits: { repas?: boolean } }>(
  () => `/api/events/${refEvenement}/acces-gestion`,
  { key: `acces-gestion-${refEvenement}`, server: false }
)
const repasOuverts = computed(() => !!acces.value?.modules.repas && !!acces.value?.droits.repas)
const repasOuvert = ref(false)
const organisateurDesRepas = ref<{ id: number; user: Compte } | null>(null)
function ouvrirRepas(o: { id: number; compte: Compte }) {
  organisateurDesRepas.value = { id: o.id, user: o.compte }
  repasOuvert.value = true
}

// ── Lien d'invitation affiché ──────────────────────────────────────────────────────────────
const lienAfficher = ref<{ lien: string; pour: string } | null>(null)
async function copier() {
  if (!lienAfficher.value) return
  await navigator.clipboard.writeText(lienAfficher.value.lien)
  toast.add({ title: 'Lien copié', icon: 'i-heroicons-check', color: 'success' })
}

// ── Ajout ──────────────────────────────────────────────────────────────────────────────────
const ajout = reactive({
  identifiant: '',
  prenom: '',
  nom: '',
  droits: droitsParDefaut(),
})
const inviter = ref(false)

const { execute: ajouter, loading: ajoutEnCours } = useApiAction<
  unknown,
  { id: number; lienInvitation: string | null }
>(base, {
  method: 'POST',
  body: () => ({
    identifiant: ajout.identifiant,
    droits: ajout.droits,
    ...(inviter.value ? { prenom: ajout.prenom, nom: ajout.nom } : {}),
  }),
  successMessage: { title: 'Organisateur ajouté' },
  // Le cas « aucun compte » n'est pas une erreur à afficher : il ouvre l'invitation.
  silentError: true,
  onError: (e) => {
    if (e.statusCode === 404 && e.data?.data && (e.data.data as { inviter?: boolean }).inviter) {
      inviter.value = true
      return
    }
    toast.add({
      title: e.data?.message || e.message || "L'organisateur n'a pas pu être ajouté",
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  },
  onSuccess: async (r) => {
    if (r?.lienInvitation) {
      lienAfficher.value = { lien: r.lienInvitation, pour: `${ajout.prenom} ${ajout.nom}`.trim() }
    }
    Object.assign(ajout, { identifiant: '', prenom: '', nom: '' })
    inviter.value = false
    await refresh()
  },
})

// ── Droits ─────────────────────────────────────────────────────────────────────────────────
const droitEnCours = ref<number | null>(null)
const changement = ref<Partial<Record<Cle, boolean>>>({})
const { execute: envoyerDroit } = useApiActionById((id) => `${base}/${id}`, {
  method: 'PATCH',
  body: () => changement.value,
  successMessage: { title: 'Droits mis à jour' },
  errorMessages: { default: "Les droits n'ont pas pu être modifiés" },
  onSuccess: () => refresh(),
})
async function changerDroit(id: number, cle: Cle, valeur: boolean) {
  changement.value = { [cle]: valeur }
  droitEnCours.value = id
  try {
    await envoyerDroit(id)
  } finally {
    droitEnCours.value = null
  }
}

// ── Nouveau lien ───────────────────────────────────────────────────────────────────────────
const lienEnCours = ref<number | null>(null)
async function nouveauLien(id: number, pour: string) {
  lienEnCours.value = id
  try {
    const r = await $fetch<{ data: { lienInvitation: string } }>(`${base}/${id}/lien`, {
      method: 'POST',
    })
    lienAfficher.value = { lien: r.data.lienInvitation, pour }
  } catch {
    toast.add({ title: "Le lien n'a pas pu être créé", color: 'error' })
  } finally {
    lienEnCours.value = null
  }
}

// ── Retrait ────────────────────────────────────────────────────────────────────────────────
const { execute: retirerDeLEquipe } = useApiActionById((id) => `${base}/${id}`, {
  method: 'DELETE',
  successMessage: { title: 'Organisateur retiré' },
  errorMessages: { default: "L'organisateur n'a pas pu être retiré" },
  onSuccess: () => refresh(),
})
function retirer(o: Liste['organisateurs'][number]) {
  confirmation.demanderConfirmation({
    titre: "Retirer de l'équipe ?",
    description: `${nom(o.compte)} ne pourra plus gérer cet événement. Son compte reste.`,
    libelleConfirmer: 'Retirer',
    couleurConfirmer: 'error',
    agir: () => retirerDeLEquipe(o.id),
  })
}
</script>
