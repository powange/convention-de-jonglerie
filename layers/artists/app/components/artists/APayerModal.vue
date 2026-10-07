<template>
  <UModal
    v-model:open="ouverte"
    :title="$t('artists.to_pay_title')"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('artists.to_pay_help') }}
        </p>

        <UiEtatVide
          v-if="!aPayer.length"
          icone="i-heroicons-check-circle"
          :titre="$t('artists.to_pay_empty')"
        />

        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <li
            v-for="ligne in aPayer"
            :key="ligne.artiste.id"
            :data-a-payer="ligne.artiste.id"
            class="py-4 flex flex-col sm:flex-row sm:items-start gap-3"
          >
            <UiUserAvatar :user="ligne.artiste.user" size="lg" class="shrink-0" />

            <!-- De quoi payer : qui, comment le joindre, et sur quel compte. -->
            <div class="min-w-0 flex-1 space-y-1">
              <p class="font-medium text-gray-900 dark:text-white truncate">
                {{ nomCompletDUnCompte(ligne.artiste.user) }}
              </p>

              <p class="text-xs text-gray-600 dark:text-gray-400 break-all">
                <ULink :to="`mailto:${ligne.artiste.user.email}`">
                  {{ ligne.artiste.user.email }}
                </ULink>
                <template v-if="ligne.artiste.user.phone">
                  ·
                  <ULink :to="`tel:${ligne.artiste.user.phone}`">
                    {{ ligne.artiste.user.phone }}
                  </ULink>
                </template>
              </p>

              <!--
                ⚠️ L'IBAN EN ENTIER, ET PAR GROUPES DE QUATRE. C'est ici, et ici seulement, qu'on
                en a besoin : cette liste existe pour faire les virements, et un IBAN tronqué
                obligerait à rouvrir chaque fiche. Le tableau de la page, lui, n'en montre qu'une
                icône — il se parcourt à plusieurs et sur un écran partagé.
              -->
              <p
                v-if="ligne.artiste.iban"
                class="text-xs font-mono text-gray-700 dark:text-gray-300 break-all"
              >
                {{ formaterIbanParGroupes(ligne.artiste.iban) }}
                <span v-if="ligne.artiste.bic" class="text-gray-500 dark:text-gray-400">
                  · {{ ligne.artiste.bic }}
                </span>
              </p>
              <p v-else class="text-xs text-amber-600 dark:text-amber-400">
                {{ $t('artists.to_pay_no_bank') }}
              </p>
            </div>

            <!-- Ce qu'on lui doit, et de quoi c'est fait. -->
            <div class="sm:text-right shrink-0 space-y-1">
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ formatAmount(ligne.dette.total) }}
              </p>
              <!-- Le détail n'apparaît que s'il y a plusieurs dettes : répéter le total sous
                   lui-même n'apprendrait rien. -->
              <p
                v-if="ligne.detail.length > 1"
                class="text-xs text-gray-500 dark:text-gray-400 sm:text-right"
              >
                {{ ligne.detail.join(' + ') }}
              </p>
              <UButton
                color="success"
                variant="soft"
                size="xs"
                icon="i-heroicons-check"
                :loading="soldeEnCours === ligne.artiste.id"
                :disabled="soldeEnCours != null"
                @click="solder(ligne.artiste)"
              >
                {{ $t('artists.to_pay_mark') }}
              </UButton>
            </div>
          </li>
        </ul>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <p class="text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ $t('common.total') }} : </span>
          <span class="font-semibold text-gray-900 dark:text-white">{{ formatAmount(total) }}</span>
        </p>
        <UButton color="neutral" variant="soft" @click="ouverte = false">
          {{ $t('common.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { formaterIbanParGroupes } from '~~/shared/utils/coordonnees-bancaires'
import { nomCompletDUnCompte } from '~~/shared/utils/nom-affichable'
import {
  detteDUnArtiste,
  drapeauxDeSolde,
  resteAPayer,
  resteAVerserEnTout,
  type ArtisteAPayer,
} from '~~/shared/utils/reste-a-verser-a-un-artiste'

/**
 * Les artistes qu'il reste à payer, et de quoi les payer.
 *
 * ⚠️ IL RECOIT LES ARTISTES, IL NE LES CHARGE PAS. La page les a déjà — avec leurs montants,
 * leurs drapeaux et leurs coordonnées —, et les tient à jour après chaque enregistrement. Une
 * requête à lui ferait un second jeu de données à garder en accord avec le premier, et la liste
 * pourrait contredire le tableau juste à côté.
 *
 * 📍 La liste suit donc les FILTRES du tableau, comme les trois totaux voisins : filtrer par
 * spectacle donne ce qu'on doit pour ce spectacle.
 */
const props = defineProps<{
  open: boolean
  /** Les artistes déjà filtrés, tels que le tableau les affiche. */
  artistes: Record<string, unknown>[]
  /** Met en forme un montant dans la devise de l'édition — la page la connaît, pas nous. */
  formatAmount: (montant: number) => string
  /**
   * L'artiste dont le solde est en cours d'enregistrement.
   *
   * ⚠️ IL VIENT DE LA PAGE, et ce n'est pas un détail : c'est elle qui enregistre, donc elle seule
   * sait quand c'est fini. Un indicateur tenu ici s'éteindrait aussitôt — l'émission est
   * synchrone — et afficherait un chargement qui n'a jamais lieu.
   */
  soldeEnCours?: number | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  /** Les drapeaux à poser sur cet artiste. La page enregistre : elle sait recharger ensuite. */
  solder: [{ artistId: number; drapeaux: Record<string, true> }]
}>()

const { t } = useI18n()

const ouverte = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

type ArtisteDeLaListe = ArtisteAPayer & {
  id: number
  iban?: string | null
  bic?: string | null
  user: { email: string; phone?: string | null }
}

const aPayer = computed(() =>
  (props.artistes as unknown as ArtisteDeLaListe[])
    .filter((artiste) => resteAPayer(artiste))
    .map((artiste) => {
      const dette = detteDUnArtiste(artiste)
      // Nommer chaque dette : « 600 € de cachet » ne se devine pas d'un total.
      const detail = [
        dette.cachet > 0 ? `${props.formatAmount(dette.cachet)} ${t('artists.to_pay_fee')}` : null,
        dette.defraiement > 0
          ? `${props.formatAmount(dette.defraiement)} ${t('artists.to_pay_travel')}`
          : null,
        dette.consommables > 0
          ? `${props.formatAmount(dette.consommables)} ${t('artists.to_pay_consumables')}`
          : null,
      ].filter((part): part is string => part !== null)

      return { artiste, dette, detail }
    })
    // Le plus gros d'abord : c'est celui qu'on ne veut pas oublier.
    .sort((a, b) => b.dette.total - a.dette.total)
)

const total = computed(() => resteAVerserEnTout(props.artistes as unknown as ArtisteAPayer[]))

/**
 * Marquer tout ce qu'on doit à cet artiste comme versé.
 *
 * 📍 `drapeauxDeSolde` ne pose que les drapeaux des dettes RÉELLEMENT dues : écrire « remboursé »
 * sur une somme qui n'existe pas ferait annoncer un remboursement jamais fait.
 */
function solder(artiste: ArtisteDeLaListe) {
  const drapeaux = drapeauxDeSolde(artiste)
  // Rien à solder : ne pas appeler. Un enregistrement sans contenu ne ferait que toucher
  // `updatedAt`, et la ligne n'aurait de toute façon pas dû être là.
  if (!Object.keys(drapeaux).length) return

  // La page enregistre PUIS recharge les artistes : la ligne disparaîtra d'elle-même de `aPayer`.
  emit('solder', { artistId: artiste.id, drapeaux: drapeaux as Record<string, true> })
}
</script>
