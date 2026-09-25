<template>
  <div class="space-y-4">
    <!-- État vide -->
    <div
      v-if="acts.length === 0"
      class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center"
    >
      <UIcon name="i-heroicons-queue-list" class="text-4xl text-gray-400 dark:text-gray-500" />
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('gestion.shows.no_acts') }}</p>
      <UButton icon="i-heroicons-plus" color="primary" variant="soft" size="sm" @click="add">
        {{ $t('gestion.shows.add_act') }}
      </UButton>
    </div>

    <!-- Une carte par numéro -->
    <!-- Le corps de la carte n'a pas de marge propre : elle est portée par le bloc repliable, sans
         quoi un numéro replié laisserait une bande vide sous son en-tête.

         `ui` ne dépend PAS de l'état déplié, et c'est délibéré : une classe issue d'un état décidé
         côté client resterait figée sur sa valeur de rendu serveur — Vue ne corrige pas les classes
         à l'hydratation. Le `v-show`, lui, est bien rétabli au montage. -->
    <UCard v-for="(act, index) in acts" :key="index" :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <!--
          Trois lignes, et non une seule qui se partage la largeur : le rang et les actions, puis le
          titre, puis les artistes.

          Le titre disposait d'abord de la place qui restait entre le rang et les boutons, et se
          faisait tronquer d'un « … » — soit précisément ce qu'on cherchait à lire sans déplier. Sur
          sa propre ligne, il prend toute la largeur et passe à la ligne autant qu'il lui faut.
        -->
        <div class="space-y-2">
          <!-- Ligne 1 : le rang, et ce qu'on peut faire du numéro. -->
          <div class="flex items-center justify-between gap-2">
            <UBadge color="primary" variant="subtle" class="shrink-0">
              {{ $t('gestion.shows.act_number', { number: index + 1 }) }}
            </UBadge>
            <div class="flex gap-1 shrink-0">
              <UButton
                icon="i-heroicons-arrow-up"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="index === 0"
                :aria-label="$t('gestion.shows.act_move_up')"
                @click="move(index, -1)"
              />
              <UButton
                icon="i-heroicons-arrow-down"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="index === acts.length - 1"
                :aria-label="$t('gestion.shows.act_move_down')"
                @click="move(index, 1)"
              />
              <UButton
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="xs"
                :aria-label="$t('gestion.shows.act_delete')"
                @click="demanderLeRetrait(act, index)"
              />
            </div>
          </div>

          <!-- Ligne 2 : le titre, qui commande le repli. C'est la cible la plus large de la carte,
               ce qui en fait la plus sûre au pouce — le geste qui a motivé ce chantier. Les boutons
               d'action sont restés sur la ligne du dessus : un bouton dans un bouton n'est pas du
               HTML valide, et le clic y serait ambigu. -->
          <UButton
            variant="ghost"
            color="neutral"
            block
            class="group items-start justify-between gap-2 p-0 text-left hover:bg-transparent"
            :ui="{
              trailingIcon:
                'group-data-[state=open]:rotate-180 transition-transform duration-200 mt-0.5 shrink-0',
            }"
            trailing-icon="i-heroicons-chevron-down"
            :data-state="estDeplie(act) ? 'open' : 'closed'"
            :aria-expanded="estDeplie(act)"
            :aria-label="$t('gestion.shows.act_toggle')"
            @click="basculer(act)"
          >
            <!-- `whitespace-normal` défait le `whitespace-nowrap` que `UButton` pose sur son
                 contenu, et `wrap-break-word` coupe un mot qui dépasserait à lui seul la largeur. -->
            <span
              class="min-w-0 flex-1 whitespace-normal wrap-break-word font-medium"
              :class="{ 'text-gray-400 dark:text-gray-500 italic': !act.title }"
            >
              {{ act.title || $t('gestion.shows.act_untitled') }}
            </span>
          </UButton>

          <!-- La compagnie, replié seulement : c'est le nom sous lequel le numéro se présente, et
               souvent celui que l'organisateur cherche. -->
          <p
            v-if="!estDeplie(act) && act.companyName.trim()"
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            {{ act.companyName }}
          </p>

          <!-- Ligne 3 : les artistes, replié seulement. Déplié, ils sont déjà dans le corps sous
               leur champ, et les répéter ici n'apprendrait rien. -->
          <div v-if="!estDeplie(act) && artistsOf(act).length > 0" class="flex flex-wrap gap-2">
            <UBadge
              v-for="artist in artistsOf(act)"
              :key="artist.id"
              color="warning"
              variant="subtle"
            >
              <UiUserName :user="artist.user" />
            </UBadge>
          </div>
        </div>
      </template>

      <!-- `v-show` et non `v-if` : le champ des artistes est un menu de sélection avec son propre
           état, et le démonter à chaque repli le perdrait. -->
      <div v-show="estDeplie(act)" class="space-y-4 p-4 sm:p-6">
        <!-- Titre + Durée -->
        <div class="flex flex-col gap-4 sm:flex-row">
          <UFormField :label="$t('gestion.shows.act_title')" required class="flex-1">
            <UInput
              v-model="act.title"
              :placeholder="$t('gestion.shows.act_title_placeholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('gestion.shows.act_company_name')" class="flex-1">
            <UInput
              v-model="act.companyName"
              :placeholder="$t('gestion.shows.act_company_name_placeholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('gestion.shows.act_duration')" class="sm:w-40">
            <!-- Pas de 5 min sur les boutons, pratique pour les durées courantes, mais step-snapping
                 désactivé : sans lui la saisie est ramenée au multiple le plus proche et une durée
                 de 6 minutes devient impossible à entrer. -->
            <UInputNumber
              v-model="act.duration"
              :min="0"
              :step="5"
              :step-snapping="false"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Artistes -->
        <UFormField :label="$t('gestion.shows.act_artists')">
          <USelectMenu
            v-model="act.artistIds"
            :items="artistOptions"
            value-key="value"
            multiple
            :placeholder="$t('gestion.shows.select_artists')"
            class="w-full"
          >
            <template #default>
              <span v-if="act.artistIds.length === 0">
                {{ $t('gestion.shows.no_artists_selected') }}
              </span>
              <span v-else>
                {{ $t('gestion.shows.artists_count', { count: act.artistIds.length }) }}
              </span>
            </template>
          </USelectMenu>
        </UFormField>

        <div v-if="artistsOf(act).length > 0" class="flex flex-wrap gap-2">
          <UBadge
            v-for="artist in artistsOf(act)"
            :key="artist.id"
            color="warning"
            variant="subtle"
          >
            <UiUserName :user="artist.user" />
          </UBadge>
        </div>

        <!-- Description -->
        <UFormField :label="$t('gestion.shows.act_description')">
          <UTextarea
            v-model="act.description"
            :placeholder="$t('gestion.shows.act_description_placeholder')"
            rows="2"
            class="w-full"
          />
        </UFormField>

        <!-- Besoins techniques + Mise en place scène -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField :label="$t('gestion.shows.act_technical_needs')">
            <UTextarea
              v-model="act.technicalNeeds"
              :placeholder="$t('gestion.shows.act_technical_needs_placeholder')"
              rows="3"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('gestion.shows.act_stage_setup')">
            <UTextarea
              v-model="act.stageSetup"
              :placeholder="$t('gestion.shows.act_stage_setup_placeholder')"
              rows="3"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>
    </UCard>

    <!-- Ajouter un numéro -->
    <UButton
      v-if="acts.length > 0"
      icon="i-heroicons-plus"
      color="neutral"
      variant="outline"
      block
      @click="add"
    >
      {{ $t('gestion.shows.add_act') }}
    </UButton>

    <UiConfirmationDemandee :confirmation="confirmation" />
  </div>
</template>

<script setup lang="ts">
interface ActInput {
  /**
   * Identifiant d'un numéro déjà enregistré, à renvoyer tel quel : c'est lui qui permet au
   * serveur de mettre à jour la ligne plutôt que de la remplacer. Absent pour un numéro ajouté
   * dans le formulaire.
   */
  id?: number
  title: string
  /**
   * Compagnie ou nom de scène. Rempli à l'import d'une candidature, corrigeable ici.
   *
   * Une CHAÎNE et non `string | null`, contrairement aux champs voisins : `UInput` refuse `null` en
   * `v-model`, et c'est précisément ce qui leur vaut une erreur de typage. Vide ici, le champ
   * redevient `null` à l'enregistrement.
   */
  companyName: string
  duration: number | string | null
  description: string | null
  technicalNeeds: string | null
  stageSetup: string | null
  artistIds: number[]
}

const { t } = useI18n()

const acts = defineModel<ActInput[]>({ required: true })

const props = defineProps<{
  artists: any[]
}>()

const artistOptions = computed(() =>
  props.artists.map((artist) => ({
    label: `${artist.user?.prenom || ''} ${artist.user?.nom || ''}`.trim() || artist.user?.email,
    value: artist.id,
  }))
)

const artistsOf = (act: ActInput) => props.artists.filter((a) => act.artistIds.includes(a.id))

/**
 * Les numéros dépliés, désignés par le numéro LUI-MÊME et non par son rang.
 *
 * Le rang ne peut pas servir de clé ici : réordonner deux numéros échangerait leurs états, et
 * supprimer le troisième ferait glisser l'état de tous les suivants. Le défaut serait discret —
 * un numéro qui s'ouvre ou se ferme de lui-même après un déplacement.
 *
 * `add`, `remove` et `move` remplacent le tableau mais conservent les objets qu'il contient :
 * l'identité survit donc à toutes les opérations, et il n'y a rien à tenir à jour ici.
 *
 * ⚠️ `toRaw` des deux côtés. Le gabarit voit les numéros à travers le proxy réactif, `add` les
 * crée en clair : sans cela, un numéro ajouté ne se reconnaîtrait pas dans son propre ensemble.
 */
const deplies = ref(new Set<object>())

const estDeplie = (act: ActInput) => deplies.value.has(toRaw(act))

const basculer = (act: ActInput) => {
  const cle = toRaw(act)
  if (deplies.value.has(cle)) deplies.value.delete(cle)
  else deplies.value.add(cle)
}

const add = () => {
  // Un numéro qu'on vient d'ajouter s'ouvre : on l'ajoute pour le remplir, et il n'a pas encore de
  // nom à lire replié.
  const nouveau: ActInput = {
    title: '',
    companyName: '',
    duration: null,
    description: null,
    technicalNeeds: null,
    stageSetup: null,
    artistIds: [],
  }
  deplies.value.add(nouveau)
  acts.value = [...acts.value, nouveau]
}

const confirmation = useConfirmation()

/**
 * Le retrait d'un numéro passe par une confirmation, et se fait PAR IDENTITÉ.
 *
 * Par identité pour la même raison que l'état déplié : un rang ne désigne pas durablement un
 * numéro dans une liste qu'on réordonne. Le retrait de l'entrée dépliée au passage évite de garder
 * une référence morte.
 *
 * ⚠️ Le libellé dit « retiré de la liste » et non « supprimé », parce que c'est ce qui se passe :
 * la page n'enregistre qu'au bouton « Enregistrer ». Annoncer une suppression immédiate serait faux
 * dans les deux sens — on peut encore quitter la page sans rien perdre, et à l'inverse rien n'est
 * perdu tant qu'on n'a pas enregistré.
 */
const demanderLeRetrait = (act: ActInput, index: number) => {
  const nom = act.title.trim() || t('gestion.shows.act_number', { number: index + 1 })
  confirmation.demanderConfirmation({
    description: t('gestion.shows.act_delete_confirm', { name: nom }),
    libelleConfirmer: t('common.delete'),
    agir: () => retirer(act),
  })
}

const retirer = (act: ActInput) => {
  const cle = toRaw(act)
  deplies.value.delete(cle)
  acts.value = acts.value.filter((a) => toRaw(a) !== cle)
}

// L'ordre du tableau fait foi : c'est lui que le serveur convertit en position
const move = (index: number, delta: number) => {
  const target = index + delta
  if (target < 0 || target >= acts.value.length) return
  const next = [...acts.value]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  acts.value = next
}
</script>
