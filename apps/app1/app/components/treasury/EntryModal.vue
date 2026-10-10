<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <div class="space-y-4">
        <!--
          ⚠️ AUCUN CHOIX DE NATURE, ni à la création ni à la modification.

          À la création, le bouton d'où l'on vient l'a tranchée — « Ajouter une charge » ou
          « Ajouter un produit » — et le titre de la modale la redit. À la modification, elle ne
          change plus : décidé avec l'utilisateur le 06/10/2026, « le produit est un produit et
          restera un produit ». Le serveur refuse d'ailleurs un changement de nature, pour que la
          règle ne tienne pas qu'à l'écran.

          📍 Rattraper une ligne du mauvais côté se fait donc en la supprimant et en la
          ressaisissant — un geste de plus, mais aucune ambiguïté sur ce que porte une ligne.
        -->

        <UFormField :label="$t('gestion.treasury.entry_title')" required>
          <UInput v-model="form.title" class="w-full" maxlength="150" />
        </UFormField>

        <UFormField :label="$t('common.description')">
          <UTextarea v-model="form.description" class="w-full" :rows="2" maxlength="2000" />
        </UFormField>

        <!--
          Trois lignes distinctes, à toutes les largeurs. Côte à côte, le montant et la date se
          serraient sur 12 rem chacun tandis que le code d'imputation prenait le reste : une
          fenêtre de saisie ne gagne rien à être dense, et ces trois champs se remplissent l'un
          après l'autre.
        -->
        <div class="flex flex-col gap-4">
          <!--
            Un produit peut tirer son montant de TARIFS de billetterie au lieu d'être saisi.

            ⚠️ Réservé aux produits : rattacher des ventes à une charge inverserait le signe d'un
            encaissement, et le serveur le refuse. L'interrupteur n'apparaît donc pas sur une
            charge, plutôt que d'être proposé puis rejeté.
          -->
          <UFormField
            v-if="form.kind === 'INCOME' && tarifsDisponibles.length > 0"
            :label="$t('gestion.treasury.amount_from_tiers')"
            :description="$t('gestion.treasury.amount_from_tiers_help')"
          >
            <USwitch v-model="montantDepuisTarifs" />
          </UFormField>

          <UFormField v-if="montantCalcule" :label="$t('gestion.treasury.linked_tiers')" required>
            <!-- Un tarif déjà rattaché ailleurs n'est pas proposé : son montant serait compté deux
                 fois, et le serveur le refuserait sans qu'on sache par qui il est pris. -->
            <USelectMenu
              v-model="tarifsChoisis"
              multiple
              :items="tarifsDisponibles"
              label-key="label"
              value-key="id"
              class="w-full"
              :placeholder="$t('gestion.treasury.linked_tiers_placeholder')"
            />
          </UFormField>

          <UFormField v-else :label="$t('common.amount')" required>
            <!--
              Saisie en unité courante ; le serveur convertit en centimes.

              ⚠️ `UiMoneyInput` ET NON `UInputNumber`, et ce n'est pas une préférence de style :
              `UInputNumber` lisait « 12,50 » comme 1 250 — la virgule prise pour un séparateur de
              milliers, faute de locale. Mesuré, et enregistré tel quel en base. Voir la note du
              composant.
            -->
            <UiMoneyInput v-model="form.amount" :currency="currency" class="w-full" />
          </UFormField>

          <!-- La date de l'OPÉRATION : le jour où l'argent a bougé, pas celui où on le note.
               Pré-remplie à aujourd'hui pour que le cas courant ne coûte rien, et modifiable pour
               saisir a posteriori les tickets d'un week-end. -->
          <UFormField :label="$t('gestion.treasury.entry_operation_date')">
            <UiDateField v-model="form.operationDate" size="md" clearable class="w-full" />
          </UFormField>

          <UFormField :label="$t('gestion.treasury.entry_code')">
            <USelectMenu
              v-model="form.codeId"
              value-key="value"
              :items="codeItems"
              class="w-full"
              :search-input="{ placeholder: $t('gestion.treasury.code_search_all') }"
              :search-term="rechercheCode"
              @update:search-term="(v: string) => (rechercheCode = v)"
            />
          </UFormField>
        </div>

        <!-- Prévisionnel : bascule le montant du réglé vers l'engagé. Le solde ne change pas,
             mais le réglé cesse de compter ce qui n'a pas été payé. -->
        <UCheckbox
          v-model="form.isForecast"
          :label="$t('gestion.treasury.entry_forecast')"
          :description="$t('gestion.treasury.entry_forecast_hint')"
        />

        <!-- L'avance ne concerne que les dépenses : une recette n'est avancée par personne. -->
        <template v-if="form.kind === 'EXPENSE'">
          <UFormField :label="$t('gestion.treasury.entry_advanced_by')">
            <div class="space-y-2">
              <!-- Un compte OU un nom libre : beaucoup de ceux qui avancent de l'argent sur une
                   convention n'ont pas de compte sur le site. Deux contrôles exclusifs plutôt
                   qu'un seul permissif — la liste des membres garde sa recherche et ses avatars. -->
              <UFieldGroup>
                <UButton
                  v-for="option in modesAvance"
                  :key="option.value"
                  :color="modeAvance === option.value ? 'primary' : 'neutral'"
                  :variant="modeAvance === option.value ? 'solid' : 'outline'"
                  :icon="option.icon"
                  :label="option.label"
                  @click="choisirModeAvance(option.value)"
                />
              </UFieldGroup>

              <UserSelector
                v-if="modeAvance === 'compte'"
                v-model="personneAvance"
                v-model:search-term="rechercheAvance"
                :searched-users="candidatsAvance"
                :searching-users="rechercheEnCours"
                :placeholder="$t('gestion.treasury.entry_advanced_by_placeholder')"
              />

              <!-- `create-item` : les noms déjà saisis sur cette édition sont proposés, et un nom
                   inédit se tape quand même. Sans cela, il fallait réécrire « Jean-Luc » à
                   l'identique sur chaque ligne — et la moindre variante d'orthographe aurait
                   séparé sa dette en deux dans le panneau des avances. -->
              <USelectMenu
                v-else
                v-model="nomAvance"
                create-item
                :items="nomsAvanceProposes"
                class="w-full"
                :placeholder="$t('gestion.treasury.entry_advanced_by_free_placeholder')"
                :search-input="{
                  placeholder: $t('gestion.treasury.entry_advanced_by_free_search'),
                }"
                @create="ajouterNomAvance"
              />
            </div>
          </UFormField>

          <!-- Sans personne désignée, il n'y a rien à rembourser : la case n'aurait aucun sens. -->
          <UCheckbox
            v-if="personneAvance || nomAvance"
            v-model="form.reimbursed"
            :label="$t('gestion.treasury.entry_reimbursed')"
          />
        </template>

        <!-- Le justificatif ferme le formulaire : c'est la dernière chose qu'on fait, souvent
             en photographiant le ticket qu'on a encore en main. -->
        <UFormField :label="$t('gestion.treasury.entry_receipt')">
          <!-- Le PDF est accepté en plus des images : beaucoup de factures n'existent que sous
               cette forme, et il fallait jusqu'ici en faire une capture d'écran. La même liste est
               appliquée côté serveur par `ALLOWED_RECEIPT_*` — celle-ci ne fait que cadrer le
               sélecteur de fichiers. -->
          <UiImageUpload
            v-model="form.imageUrl"
            allow-camera
            :endpoint="{ type: 'treasury', id: editionId }"
            :options="{
              validation: {
                maxSize: 10 * 1024 * 1024,
                allowedTypes: [
                  'image/jpeg',
                  'image/png',
                  'image/webp',
                  'image/gif',
                  'application/pdf',
                ],
                allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'],
              },
            }"
            :alt="$t('gestion.treasury.entry_receipt')"
            :placeholder="$t('gestion.treasury.entry_receipt_placeholder')"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('common.cancel')"
          @click="isOpen = false"
        />
        <UButton :loading="saving" :disabled="!isValid" :label="$t('common.save')" @click="save" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useDebounce } from '@vueuse/core'

import type { UserSelectItem } from '~/components/UserSelector.vue'

import { cleDuNomAvance, nomAvanceAEnregistrer } from '~~/shared/utils/avance-nom-libre'

/** Ce que l'API rend d'une personne ayant avancé — de quoi l'afficher, rien de plus. */
interface CandidatAvance {
  id: number
  pseudo: string
  profilePicture?: string | null
  emailHash?: string | null
}

/**
 * La date d'opération à afficher dans le champ, au format `AAAA-MM-JJ`.
 *
 * Trois cas, et le troisième est celui qui compte :
 *
 * - **nouvelle entrée** : aujourd'hui. C'est le cas courant, et le champ reste modifiable pour
 *   saisir a posteriori les tickets d'un week-end ;
 * - **entrée qui a une date** : la sienne ;
 * - **entrée antérieure au champ** : **vide**. Lui proposer aujourd'hui lui inventerait une date
 *   d'opération au premier enregistrement — précisément ce qu'on a décidé de ne pas faire.
 *
 * Le découpage se fait sur l'ISO en UTC, jamais sur l'heure locale : la colonne est une DATE, et
 * la relire dans le fuseau du navigateur la ferait glisser d'un jour à l'ouest de Greenwich.
 */
const dateDeLEntree = (entree?: { operationDate?: string | null } | null): string => {
  if (!entree) return new Date().toISOString().slice(0, 10)
  return entree.operationDate ? new Date(entree.operationDate).toISOString().slice(0, 10) : ''
}

const props = defineProps<{
  open: boolean
  /**
   * Le sens imposé par le bouton d'où vient l'ouverture — « Ajouter une charge » ou « Ajouter un
   * produit ».
   *
   * Absent en modification : la ligne porte déjà son sens, et on garde la possibilité de le
   * changer. Présent en création, il masque le sélecteur et pose la nature d'emblée.
   */
  sensImpose?: 'EXPENSE' | 'INCOME' | null
  /** Ligne existante à modifier, ou `null` pour une création. */
  entry: {
    entryId?: number
    kind: 'EXPENSE' | 'INCOME'
    title: string
    /** Les tarifs rattachés, s'il s'agit d'un produit calculé. */
    tierIds?: number[]
    description?: string | null
    /**
     * Le montant réglé, en centimes. Zéro sur une ligne prévisionnelle : `treasury-compute` place
     * alors le montant dans `pending`.
     */
    settled: number
    /**
     * Le montant engagé mais non réglé, en centimes. C'est là que vit le montant d'une ligne
     * PRÉVISIONNELLE — sans lui, rouvrir une telle ligne affichait zéro.
     */
    pending?: number
    code?: { id: number } | null
    imageUrl?: string | null
    isForecast?: boolean
    operationDate?: string | null
    reimbursed?: boolean
    advancedBy?: CandidatAvance | null
    advancedByName?: string | null
  } | null
  codes: { id: number; code: string; label: string }[]
  /**
   * Les tarifs de l'édition, et pour chacun la ligne qui le réclame déjà (`prisPar`).
   *
   * Fournis par la trésorerie elle-même, avec les codes : la modale en a besoin dès son ouverture.
   */
  tiers?: { id: number; label: string; countAsParticipant: boolean; prisPar: number | null }[]
  currency: string
  editionId: number
  /** Les noms libres déjà employés sur cette édition, à reproposer plutôt qu'à faire retaper. */
  nomsAvanceConnus?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved'): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const form = reactive<{
  kind: 'EXPENSE' | 'INCOME'
  title: string
  description: string
  amount: number | null
  codeId: number | null
  imageUrl: string | null
  isForecast: boolean
  /** Date de l'opération au format `AAAA-MM-JJ`. Vide = non renseignée. */
  operationDate: string
  reimbursed: boolean
}>({
  kind: 'EXPENSE',
  title: '',
  description: '',
  amount: 0,
  codeId: null,
  imageUrl: null,
  isForecast: false,
  operationDate: '',
  reimbursed: false,
})

/**
 * La personne qui a avancé, telle que `UserSelector` la manipule. Séparée de `form` parce que le
 * composant travaille sur un objet complet là où l'API n'attend qu'un identifiant.
 */
const personneAvance = ref<UserSelectItem | null>(null)

/**
 * Le nom libre, et le mode qui décide lequel des deux contrôles compte.
 *
 * Les deux valeurs ne coexistent jamais : basculer de mode efface l'autre. Sans cela, une ligne
 * pourrait partir avec un compte ET un nom, et le serveur devrait trancher à la place de qui
 * saisit — ce qu'il fait par sécurité, mais en silence.
 */
// `undefined` et non `null` : c'est ce que `USelectMenu` accepte comme « rien de choisi ». Le
// corps envoyé au serveur le retraduit en `null`, qui est ce que la colonne attend.
const nomAvance = ref<string | undefined>(undefined)
const modeAvance = ref<'compte' | 'libre'>('compte')
/** Les noms proposés : ceux déjà en base, plus celui qu'on vient de créer dans cette session. */
const nomsAjoutes = ref<string[]>([])
const rechercheAvance = ref('')
const rechercheDebouncee = useDebounce(rechercheAvance, 300)
const candidatsAvance = ref<UserSelectItem[]>([])
const rechercheEnCours = ref(false)

watch(rechercheDebouncee, async (terme) => {
  rechercheEnCours.value = true
  try {
    const reponse = await $fetch<{ data: { users: CandidatAvance[] } }>(
      `/api/editions/${props.editionId}/treasury/advance-candidates`,
      { params: terme ? { search: terme } : {} }
    )
    candidatsAvance.value = (reponse?.data?.users ?? []).map((u) => ({
      id: u.id,
      label: u.pseudo,
      pseudo: u.pseudo,
      email: '',
      emailHash: u.emailHash ?? '',
      profilePicture: u.profilePicture,
      isRealUser: true,
    }))
  } catch {
    candidatsAvance.value = []
  } finally {
    rechercheEnCours.value = false
  }
})

const modesAvance = computed(() => [
  {
    value: 'compte' as const,
    icon: 'i-heroicons-user-circle',
    label: t('gestion.treasury.entry_advanced_by_member'),
  },
  {
    value: 'libre' as const,
    icon: 'i-heroicons-pencil-square',
    label: t('gestion.treasury.entry_advanced_by_free'),
  },
])

/** Les noms déjà connus de l'édition, plus ceux créés depuis l'ouverture de la modale. */
const nomsAvanceProposes = computed(() => {
  const vus = new Set<string>()
  const noms: string[] = []
  for (const nom of [...(props.nomsAvanceConnus ?? []), ...nomsAjoutes.value]) {
    const cle = cleDuNomAvance(nom)
    if (!cle || vus.has(cle)) continue
    vus.add(cle)
    noms.push(nom)
  }
  return noms.sort((a, b) => a.localeCompare(b, 'fr'))
})

/** Basculer de mode efface l'autre saisie : les deux ne coexistent jamais. */
function choisirModeAvance(mode: 'compte' | 'libre') {
  if (modeAvance.value === mode) return
  modeAvance.value = mode
  if (mode === 'compte') nomAvance.value = undefined
  else personneAvance.value = null
}

/** Un nom inédit rejoint la liste et devient la valeur choisie. */
function ajouterNomAvance(nom: string) {
  const propre = nomAvanceAEnregistrer(nom)
  if (!propre) return
  nomsAjoutes.value.push(propre)
  nomAvance.value = propre
}

/**
 * Les codes proposés dépendent du sens de la ligne.
 *
 * La classe du plan comptable français porte ce sens : 6 pour une charge, 7 pour un produit.
 * Rien ne l'enregistre sur le code lui-même — c'est déduit du premier chiffre.
 *
 * Conséquence assumée : un code qui ne suit pas cette numérotation, saisi librement (« REPAS »,
 * « A1 »), n'est proposé d'aucun côté. Il reste utilisable sur les lignes qui le portent déjà,
 * mais ne peut plus être choisi tant qu'il n'est pas renuméroté.
 */
/** Terme tapé dans le select des codes. */
const rechercheCode = ref('')

/** La règle des codes proposés vit dans `codesProposes` : elle sert aussi à la page. */
const codesAffiches = computed(() =>
  codesProposes(props.codes, {
    sens: form.kind,
    recherche: rechercheCode.value,
    codeCourantId: form.codeId,
  })
)

const codeItems = computed(() => [
  { value: null, label: t('gestion.treasury.no_code') },
  ...codesAffiches.value.map((c) => ({ value: c.id, label: `${c.code} — ${c.label}` })),
])

/**
 * Changer le sens d'une ligne peut rendre son code inéligible. On le retire alors, plutôt que de
 * laisser un identifiant sélectionné qui ne figure plus dans la liste : le champ paraîtrait vide
 * tout en envoyant l'ancien code à l'enregistrement.
 *
 * Rattaché au clic et non à un `watch` sur le sens du formulaire : celui-ci écrit lui-même ce champ à
 * chaque ouverture, et un observateur aurait effacé le code d'une ligne existante au seul motif
 * qu'elle ne suit pas la numérotation — une perte de donnée silencieuse, à l'affichage.
 */
/*
 * `kindOptions` et `choisirSens` ont été retirés avec le sélecteur de nature. Le second remettait
 * à zéro le code d'imputation quand le sens changeait : la nature ne changeant plus, il n'avait
 * plus d'appelant — et un code mort finit par être relu comme une règle encore en vigueur.
 */
const isEditing = computed(() => !!props.entry?.entryId)
/**
 * Le titre nomme la nature à la création.
 *
 * ⚠️ Nécessaire depuis que le sélecteur disparaît : sans lui, « Ajouter une ligne » ne dirait plus
 * si l'on saisit une charge ou un produit, et une erreur de côté ne se verrait qu'après
 * enregistrement.
 */
const title = computed(() => {
  if (isEditing.value) return t('gestion.treasury.edit_entry')
  if (props.sensImpose === 'EXPENSE') return t('gestion.treasury.add_expense')
  if (props.sensImpose === 'INCOME') return t('gestion.treasury.add_income')
  return t('gestion.treasury.add_entry')
})
/** L'interrupteur « montant calculé depuis des tarifs ». */
const montantDepuisTarifs = ref(false)
const tarifsChoisis = ref<number[]>([])

/**
 * Les tarifs qu'on peut encore rattacher : les libres, plus ceux de la ligne qu'on modifie.
 *
 * ⚠️ Un tarif pris par une AUTRE ligne n'est pas proposé — son montant serait compté deux fois, et
 * le serveur le refuserait sans pouvoir dire par qui il est pris. Mais ceux de la ligne courante
 * doivent rester visibles, sinon rouvrir un produit calculé afficherait un sélecteur vide et le
 * réenregistrer DÉTACHERAIT tout.
 */
const tarifsDisponibles = computed(() =>
  (props.tiers ?? []).filter(
    (tarif) => tarif.prisPar === null || tarif.prisPar === props.entry?.entryId
  )
)

/** Le montant est-il calculé ? Vrai dès que l'interrupteur est mis, sur un produit. */
const montantCalcule = computed(() => form.kind === 'INCOME' && montantDepuisTarifs.value)

/**
 * Validité : un titre, et SELON LE CAS un montant ou au moins un tarif.
 *
 * Sans cette distinction, le bouton « Enregistrer » restait désactivé sur un produit calculé —
 * dont le montant vaut zéro par construction — et rien n'expliquait pourquoi.
 */
const isValid = computed(() => {
  if (form.title.trim().length === 0) return false
  return montantCalcule.value ? tarifsChoisis.value.length > 0 : (form.amount ?? 0) > 0
})

// Repartir des valeurs de la ligne à chaque ouverture : sans cela, une modification garderait la
// saisie précédente, et une création rouvrirait le dernier montant tapé.
watch(
  () => [props.open, props.entry] as const,
  ([open, entry]) => {
    if (!open) return
    // La ligne d'abord (modification), puis le sens du bouton (création), puis le défaut.
    form.kind = entry?.kind ?? props.sensImpose ?? 'EXPENSE'
    form.title = entry?.title ?? ''
    form.description = entry?.description ?? ''
    /*
     * `settled + pending`, et non `settled` seul.
     *
     * Une ligne prévisionnelle a `settled: 0` et son montant dans `pending`
     * (`treasury-compute.ts`) : le formulaire s'ouvrait donc à 0, et comme `isValid` exige un
     * montant strictement positif, le bouton « Enregistrer » restait désactivé. La ligne était
     * impossible à modifier, même pour n'en changer que le titre.
     *
     * Les deux ne sont jamais renseignés en même temps sur une ligne saisie : la somme vaut donc le
     * montant, prévisionnel ou non.
     */
    form.amount = entry ? (entry.settled + (entry.pending ?? 0)) / 100 : 0
    form.codeId = entry?.code?.id ?? null
    form.imageUrl = entry?.imageUrl ?? null
    form.isForecast = entry?.isForecast ?? false
    form.operationDate = dateDeLEntree(entry)
    form.reimbursed = entry?.reimbursed ?? false
    personneAvance.value = entry?.advancedBy
      ? {
          id: entry.advancedBy.id,
          label: entry.advancedBy.pseudo,
          pseudo: entry.advancedBy.pseudo,
          email: '',
          emailHash: entry.advancedBy.emailHash ?? '',
          profilePicture: entry.advancedBy.profilePicture,
          isRealUser: true,
        }
      : null
    // Le mode se déduit de la ligne : rouvrir une dépense avancée par « Jean-Luc » doit montrer
    // son nom, pas un sélecteur de membres vide.
    nomAvance.value = entry?.advancedByName ?? undefined
    modeAvance.value = nomAvance.value ? 'libre' : 'compte'
    nomsAjoutes.value = []
    rechercheAvance.value = ''
    // Les tarifs de la ligne : l'interrupteur se met de lui-même si elle en porte, sans quoi
    // rouvrir un produit calculé montrerait un champ de montant à zéro.
    tarifsChoisis.value = [...(entry?.tierIds ?? [])]
    montantDepuisTarifs.value = tarifsChoisis.value.length > 0
  },
  { immediate: true }
)

const body = () => ({
  kind: form.kind,
  title: form.title.trim(),
  description: form.description.trim() || null,
  /*
   * ⚠️ AUCUN MONTANT QUAND IL EST CALCULÉ, et c'est la correction d'un vrai défaut : le formulaire
   * envoyait `0`, que le schéma du `PUT` refuse — il exige un montant strictement positif. La
   * requête repartait en 400, la modale restait ouverte, et comme un 400 est une erreur ATTENDUE
   * elle n'apparaissait dans aucun journal.
   *
   * 📍 Omettre le champ plutôt qu'assouplir le serveur : un produit calculé n'a pas de montant à
   * saisir, son corps ne doit donc pas en parler. Le serveur garde ainsi sa garantie pour les
   * lignes saisies à la main.
   */
  ...(montantCalcule.value ? {} : { amount: form.amount ?? 0 }),
  /*
   * ⚠️ `[]` ET NON `undefined` quand l'interrupteur est éteint : le tableau vide DÉTACHE les tarifs
   * côté serveur, là où l'absence du champ ne toucherait à rien. C'est ce qui permet de repasser un
   * produit calculé en produit saisi — sans cela, éteindre l'interrupteur n'aurait aucun effet.
   */
  tierIds: montantCalcule.value ? tarifsChoisis.value : [],
  codeId: form.codeId,
  imageUrl: form.imageUrl,
  isForecast: form.isForecast,
  operationDate: form.operationDate || null,
  // Le serveur remet ces champs à zéro sur une recette : inutile de filtrer ici aussi.
  // Le mode décide lequel part : l'autre est déjà nul, mais le dire ici rend la règle lisible.
  advancedById: modeAvance.value === 'compte' ? (personneAvance.value?.id ?? null) : null,
  advancedByName: modeAvance.value === 'libre' ? (nomAvance.value ?? null) : null,
  reimbursed: form.reimbursed,
})

const { execute: createEntry, loading: creating } = useApiAction(
  () => `/api/editions/${props.editionId}/treasury/entries`,
  {
    method: 'POST',
    body,
    successMessage: { title: t('gestion.treasury.entry_saved') },
    errorMessages: { default: t('gestion.treasury.entry_error') },
    onSuccess: () => emit('saved'),
  }
)

const { execute: updateEntry, loading: updating } = useApiAction(
  () => `/api/editions/${props.editionId}/treasury/entries/${props.entry?.entryId}`,
  {
    method: 'PUT',
    body,
    successMessage: { title: t('gestion.treasury.entry_saved') },
    errorMessages: { default: t('gestion.treasury.entry_error') },
    onSuccess: () => emit('saved'),
  }
)

const saving = computed(() => creating.value || updating.value)

async function save() {
  if (!isValid.value) return
  if (isEditing.value) await updateEntry()
  else await createEntry()
}
</script>
