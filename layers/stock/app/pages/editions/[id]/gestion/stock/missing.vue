<!--
  Ce qui manque, et ce qu'on rachète.

  Le recomptage de fin d'édition se fait groupe par groupe — on ouvre les caisses là où elles sont
  rangées. Mais « qu'est-ce qu'on rachète ? » ne se pose jamais groupe par groupe : elle se pose
  une fois, pour toute l'édition. Y répondre obligeait jusqu'ici à ouvrir chaque groupe et à faire
  la somme de tête.

  Trois onglets pour trois moments : ce qui manque (on décide), ce qui reste à compter (le travail
  qui rendrait la décision fiable), et les listes de courses (on achète).

  ⚠️ Le deuxième onglet n'est pas un détail d'ergonomie. Un objet jamais compté n'est pas un objet
  complet, et tant qu'il en reste, la liste des manquants est incomplète sans le dire. C'est
  pourquoi le compte des non-comptés figure aussi dans le résumé du premier onglet.

  Les règles ne vivent pas ici : `manquants-stock` classe, `liste-de-courses` lit les listes, et
  `comptage-stock` — partagé avec la page d'un groupe — dit ce qu'une saisie vaut. L'écran ne fait
  que les afficher.
-->
<template>
  <UContainer class="py-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div class="flex items-center gap-3">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          size="sm"
          :to="`/editions/${editionId}/gestion/stock`"
        />
        <UIcon name="i-heroicons-shopping-cart" class="text-primary-600 size-6" />
        <ManagementPageHeader :titre="t('gestion.stock.missing_title')" />
      </div>
    </div>

    <div v-if="chargement" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div v-else class="space-y-4">
      <!-- Les trois chiffres qui se lisent ensemble : ce qui manque, combien ça fait d'unités, et
           surtout ce qui reste à compter — sans quoi les deux premiers ne veulent rien dire. -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('gestion.stock.missing_items') }}
          </p>
          <p class="text-2xl font-semibold tabular-nums">{{ resume.objetsManquants }}</p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('gestion.stock.missing_units') }}
          </p>
          <p class="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">
            {{ resume.exemplairesARacheter }}
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('gestion.stock.missing_uncounted') }}
          </p>
          <p
            class="text-2xl font-semibold tabular-nums"
            :class="resume.nonComptes > 0 ? 'text-amber-600 dark:text-amber-400' : ''"
          >
            {{ resume.nonComptes }}
            <span class="text-base font-normal text-gray-400">/ {{ resume.total }}</span>
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('gestion.stock.missing_open_lists') }}
          </p>
          <p class="text-2xl font-semibold tabular-nums">
            {{ listesEnCours }}
            <span class="text-base font-normal text-gray-400">/ {{ listes.length }}</span>
          </p>
        </UCard>
      </div>

      <!-- Tant qu'il reste des objets à compter, la liste de rachat est incomplète. Le dire une
           fois, en clair, plutôt que de laisser déduire d'un compteur. -->
      <UAlert
        v-if="resume.nonComptes > 0"
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="t('gestion.stock.missing_incomplete_title')"
        :description="t('gestion.stock.missing_incomplete_hint', { count: resume.nonComptes })"
      />

      <UTabs v-model="ongletActif" :items="onglets" color="primary" :ui="{ list: 'w-auto' }" />

      <!-- ONGLET 1 : ce qui manque -->
      <div v-if="ongletActif === 'racheter'" class="space-y-3">
        <div v-if="tousLesManquants.length === 0" class="text-center py-12">
          <UIcon name="i-heroicons-check-circle" class="size-12 text-green-500 mx-auto mb-3" />
          <p class="text-gray-600 dark:text-gray-400">{{ t('gestion.stock.missing_none') }}</p>
        </div>

        <template v-else>
          <div class="flex flex-wrap items-center gap-3">
            <UButton
              v-if="canManage"
              size="sm"
              icon="i-heroicons-shopping-cart"
              :disabled="identifiantsSelectionnes.length === 0"
              @click="ouvrirAjout"
            >
              {{
                t('gestion.stock.shopping_add_selection', {
                  count: identifiantsSelectionnes.length,
                })
              }}
            </UButton>

            <!-- Le filtre sert aussi à qui ne peut que lire — savoir ce qui n'est prévu nulle part
                 est une question de consultation, pas d'écriture. D'où sa place hors du `v-if`. -->
            <UCheckbox
              v-model="seulementHorsListe"
              :label="t('gestion.stock.missing_filter_unlisted')"
              :ui="{ base: 'cursor-pointer', label: 'cursor-pointer' }"
            />
          </div>

          <!-- Les listes déroulantes se construisent sur l'onglet AVANT filtrage : sinon poser un
               groupe retirerait tous les autres du choix, et il deviendrait impossible d'en
               ajouter un second sans tout relâcher. -->
          <StockFiltresObjets
            v-model:recherche="rechercheManquants"
            v-model:groupes="groupesManquants"
            v-model:tags="tagsManquants"
            :objets="tousLesManquants"
          />

          <!-- Le filtre ne laisse rien passer : c'est une bonne nouvelle — tout le manque est déjà
               prévu —, et surtout PAS « rien ne manque ». La barre d'outils reste au-dessus, sans
               quoi la case qui a produit ce vide disparaîtrait avec lui, et on ne pourrait plus la
               décocher. -->
          <div v-if="manquants.length === 0" class="text-center py-12">
            <!-- Deux vides très différents, et il serait grave de les confondre : « tout le
                 manque est déjà prévu » est une bonne nouvelle, « aucun objet ne passe vos
                 filtres » n'en est pas une. Afficher la première pendant qu'un filtre cache le
                 reste ferait clore une séance de rachat qui ne l'est pas. -->
            <UIcon
              :name="
                filtresManquantsPoses
                  ? 'i-heroicons-funnel'
                  : 'i-heroicons-clipboard-document-check'
              "
              class="size-12 mx-auto mb-3"
              :class="filtresManquantsPoses ? 'text-gray-400' : 'text-green-500'"
            />
            <p class="text-gray-600 dark:text-gray-400">
              {{
                filtresManquantsPoses
                  ? t('gestion.stock.filter_no_results')
                  : t('gestion.stock.missing_all_listed')
              }}
            </p>
          </div>

          <!-- `get-row-id` fait porter les clés de sélection par l'identifiant de l'objet et non
               par son rang : le tableau se réordonne dès qu'on saisit un comptage — une ligne
               corrigée quitte la liste des manquants —, et une sélection indexée sur les positions
               désignerait alors d'autres objets que ceux cochés. Même raison que sur la page d'un
               groupe. -->
          <UTable
            v-else
            v-model:sorting="triManquants"
            v-model:row-selection="selectionLignes"
            :get-row-id="(objet: any) => String(objet.id)"
            :data="manquants"
            :columns="colonnesManquants"
          >
            <!-- La coche d'en-tête plutôt qu'un bouton : elle est là où l'on regarde déjà, en tête
                 de la colonne qu'elle commande, et son état indéterminé dit d'un coup d'œil qu'une
                 partie seulement est sélectionnée — ce qu'un bouton ne sait pas exprimer. -->
            <template #choix-header="{ table }">
              <UCheckbox
                :model-value="
                  table.getIsSomePageRowsSelected()
                    ? 'indeterminate'
                    : table.getIsAllPageRowsSelected()
                "
                :aria-label="t('common.select_all')"
                :ui="{ base: 'cursor-pointer' }"
                @update:model-value="
                  (coche: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!coche)
                "
              />
            </template>
            <template #choix-cell="{ row }">
              <UCheckbox
                :model-value="row.getIsSelected()"
                :aria-label="t('common.select')"
                :ui="{ base: 'cursor-pointer' }"
                @update:model-value="
                  (coche: boolean | 'indeterminate') => row.toggleSelected(!!coche)
                "
              />
            </template>
            <template #name-cell="{ row }">
              <div class="flex items-center gap-1.5">
                <span class="font-medium">{{ row.original.name }}</span>
                <!-- La description tient rarement sur une ligne de tableau : elle passe dans une
                   infobulle, signalée par une icône, plutôt que d’écraser la colonne. Compter du
                   matériel demande souvent de savoir de quoi il s’agit exactement — « les câbles
                   XLR, pas les jack ». Même forme que la liste d’un groupe. -->
                <UPopover
                  v-if="row.original.description?.trim()"
                  mode="hover"
                  :content="{ side: 'top' }"
                >
                  <UIcon
                    name="i-heroicons-information-circle"
                    class="size-4 text-gray-400 shrink-0"
                  />
                  <template #content>
                    <p class="p-3 text-sm max-w-xs whitespace-pre-wrap">
                      {{ row.original.description }}
                    </p>
                  </template>
                </UPopover>
              </div>
            </template>
            <template #group-cell="{ row }">
              <span class="text-sm text-gray-500">{{ row.original.group.name }}</span>
            </template>
            <template #tags-cell="{ row }">
              <div v-if="row.original.tags?.length" class="flex flex-wrap gap-1">
                <StockTagBadge
                  v-for="lien in row.original.tags"
                  :key="lien.tag.id"
                  :tag="lien.tag"
                  size="xs"
                />
              </div>
              <span v-else class="text-sm text-gray-400">—</span>
            </template>
            <template #compte-cell="{ row }">
              <UInput
                v-if="canManage"
                :model-value="saisieAffichee(row.original.id)"
                type="number"
                min="0"
                class="w-24"
                :placeholder="t('gestion.stock.count_not_counted')"
                @update:model-value="(valeur: string | number) => saisir(row.original.id, valeur)"
              />
              <span v-else class="tabular-nums">
                {{ saisieAffichee(row.original.id) || t('gestion.stock.count_not_counted') }}
              </span>
            </template>
            <template #racheter-cell="{ row }">
              <UBadge color="error" variant="subtle">
                {{ quantiteARacheter(row.original) }}
              </UBadge>
            </template>
            <!-- Où cet objet est DÉJÀ prévu. La question se pose au moment même où l'on coche des
                 lignes pour les verser dans une liste : sans cette colonne, il fallait ouvrir le
                 troisième onglet et parcourir chaque liste pour savoir si le travail avait déjà été
                 fait. Le vert dit qu'il a même déjà été acheté — auquel cas la ligne manque encore
                 ici parce que personne n'a recompté depuis. -->
            <template #listes-cell="{ row }">
              <div v-if="listesDeLObjet(row.original.id).length" class="flex flex-wrap gap-1">
                <UTooltip
                  v-for="appartenance in listesDeLObjet(row.original.id)"
                  :key="appartenance.id"
                  :text="
                    appartenance.purchased
                      ? t('gestion.stock.missing_in_list_purchased')
                      : t('gestion.stock.missing_in_list_pending')
                  "
                >
                  <UBadge
                    :color="appartenance.purchased ? 'success' : 'neutral'"
                    variant="subtle"
                    class="max-w-40"
                  >
                    <span class="truncate">{{ appartenance.name }}</span>
                  </UBadge>
                </UTooltip>
              </div>
              <span v-else class="text-sm text-gray-400">—</span>
            </template>
          </UTable>
        </template>
      </div>

      <!-- ONGLET 2 : ce qui reste à compter -->
      <div v-else-if="ongletActif === 'compter'" class="space-y-3">
        <!-- La barre reste au-dessus du vide, comme dans l'autre onglet : si elle disparaissait
             avec le tableau, on ne pourrait plus relâcher le filtre qui a produit ce vide. -->
        <StockFiltresObjets
          v-if="tousLesNonComptes.length > 0"
          v-model:recherche="rechercheACompter"
          v-model:groupes="groupesACompter"
          v-model:tags="tagsACompter"
          :objets="tousLesNonComptes"
        />

        <div v-if="nonComptes.length === 0" class="text-center py-12">
          <!-- « Tout est compté » est un aboutissement ; « rien ne passe le filtre » n'en est pas
               un. Les confondre ferait croire la séance finie alors qu'un filtre cache le reste. -->
          <UIcon
            :name="filtresACompterPoses ? 'i-heroicons-funnel' : 'i-heroicons-check-circle'"
            class="size-12 mx-auto mb-3"
            :class="filtresACompterPoses ? 'text-gray-400' : 'text-green-500'"
          />
          <p class="text-gray-600 dark:text-gray-400">
            {{
              filtresACompterPoses
                ? t('gestion.stock.filter_no_results')
                : t('gestion.stock.missing_all_counted')
            }}
          </p>
        </div>

        <UTable v-else v-model:sorting="triACompter" :data="nonComptes" :columns="colonnesACompter">
          <template #name-cell="{ row }">
            <div class="flex items-center gap-1.5">
              <span class="font-medium">{{ row.original.name }}</span>
              <UPopover
                v-if="row.original.description?.trim()"
                mode="hover"
                :content="{ side: 'top' }"
              >
                <UIcon
                  name="i-heroicons-information-circle"
                  class="size-4 text-gray-400 shrink-0"
                />
                <template #content>
                  <p class="p-3 text-sm max-w-xs whitespace-pre-wrap">
                    {{ row.original.description }}
                  </p>
                </template>
              </UPopover>
            </div>
          </template>
          <template #group-cell="{ row }">
            <span class="text-sm text-gray-500">{{ row.original.group.name }}</span>
          </template>
          <template #tags-cell="{ row }">
            <div v-if="row.original.tags?.length" class="flex flex-wrap gap-1">
              <StockTagBadge
                v-for="lien in row.original.tags"
                :key="lien.tag.id"
                :tag="lien.tag"
                size="xs"
              />
            </div>
            <span v-else class="text-sm text-gray-400">—</span>
          </template>
          <template #compte-cell="{ row }">
            <UInput
              v-if="canManage"
              :model-value="saisieAffichee(row.original.id)"
              type="number"
              min="0"
              class="w-24"
              :placeholder="t('gestion.stock.count_not_counted')"
              @update:model-value="(valeur: string | number) => saisir(row.original.id, valeur)"
            />
            <span v-else class="tabular-nums">
              {{ saisieAffichee(row.original.id) || t('gestion.stock.count_not_counted') }}
            </span>
          </template>
        </UTable>
      </div>

      <!-- ONGLET 3 : les listes de courses -->
      <div v-else class="space-y-4">
        <div
          v-if="canManage || listes.length > 1 || optionsDeTags.length > 0"
          class="flex flex-wrap items-center gap-3"
        >
          <!-- Le sélecteur ne paraît qu'à partir de deux listes : un menu à choix unique n'offre
               aucun choix, et occuperait une ligne à ne rien dire. -->
          <USelect
            v-if="listes.length > 1"
            v-model="listeChoisieId"
            :items="optionsDeListes"
            value-key="value"
            class="w-64"
            :aria-label="t('gestion.stock.shopping_lists')"
          />

          <!-- Les pastilles présentes dans la liste ouverte, et rien d'autre : sans tag à proposer,
               le menu n'aurait rien à offrir et occuperait une place qu'on lit en courses. -->
          <USelectMenu
            v-if="optionsDeTags.length > 0"
            v-model="tagsSelectionnes"
            :items="optionsDeTags"
            multiple
            :placeholder="t('gestion.stock.tags.filter_placeholder')"
            searchable
            :searchable-placeholder="t('common.search')"
            class="w-64"
            :aria-label="t('gestion.stock.tags.filter_label')"
            :ui="{ content: 'min-w-fit' }"
          >
            <template #default="{ modelValue: choisis }">
              <span v-if="!choisis?.length" class="text-gray-400">
                {{ t('gestion.stock.tags.filter_placeholder') }}
              </span>
              <div v-else class="flex flex-wrap gap-1">
                <StockTagBadge
                  v-for="option in choisis"
                  :key="option.value"
                  :tag="{ name: option.label, color: option.color }"
                  size="sm"
                />
              </div>
            </template>
            <template #item-leading="{ item: option }">
              <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: option.color }" />
            </template>
          </USelectMenu>

          <div class="ms-auto">
            <UButton v-if="canManage" size="sm" icon="i-heroicons-plus" @click="ouvrirCreationVide">
              {{ t('gestion.stock.shopping_new_list') }}
            </UButton>
          </div>
        </div>

        <div v-if="listes.length === 0" class="text-center py-12">
          <UIcon name="i-heroicons-shopping-cart" class="size-12 text-gray-300 mx-auto mb-3" />
          <p class="text-gray-600 dark:text-gray-400">{{ t('gestion.stock.shopping_no_list') }}</p>
        </div>

        <!-- Une boucle sur AU PLUS un élément, et non un `v-if` sur la liste choisie : le corps de
             la carte parle de `liste` à une quinzaine d'endroits, et le `v-for` le lui garde tel
             quel. Un `v-if` aurait demandé de tout renommer, et laissé le modèle manipuler une
             valeur que le typage tient pour possiblement absente. -->
        <UCard v-for="liste in listesAffichees" :key="liste.id">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="font-semibold">{{ liste.name }}</h2>
                <p class="text-sm text-gray-500">
                  {{
                    t('gestion.stock.shopping_progress', {
                      achetes: resumeDe(liste).achetes,
                      total: resumeDe(liste).total,
                      unites: resumeDe(liste).exemplairesRestants,
                    })
                  }}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <!-- Les gestes d’écriture disparaissent pour qui ne peut que consulter. -->
                <UBadge v-if="listeTerminee(liste.items)" color="success" variant="subtle">
                  {{ t('gestion.stock.shopping_done') }}
                </UBadge>
                <UTooltip v-if="canManage" :text="t('gestion.stock.shopping_rename')">
                  <UButton
                    icon="i-heroicons-pencil-square"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    @click="ouvrirRenommage(liste)"
                  />
                </UTooltip>
                <UTooltip v-if="canManage" :text="t('common.delete')">
                  <UButton
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="sm"
                    :loading="suppressionListe.isLoading(liste.id)"
                    @click="demanderSuppression(liste)"
                  />
                </UTooltip>
              </div>
            </div>
          </template>

          <p v-if="liste.items.length === 0" class="text-sm text-gray-500 py-2">
            {{ t('gestion.stock.shopping_list_empty') }}
          </p>

          <!-- La liste n'est pas vide, c'est le filtre qui ne laisse rien passer. Le dire, plutôt
               que d'afficher «&nbsp;cette liste est vide&nbsp;» sur une liste qui ne l'est pas. -->
          <p v-else-if="articlesDe(liste).length === 0" class="text-sm text-gray-500 py-2">
            {{ t('gestion.stock.shopping_no_match_tags') }}
          </p>

          <!-- Un tableau et non plus une suite de lignes : en courses, on cherche un objet précis
               dans la liste, et des colonnes alignées se balaient du regard là où des mentions
               empilées obligent à lire chaque ligne en entier. Le groupe cesse d'être une
               sous-ligne grise, les étiquettes deviennent lisibles, et la quantité s'aligne
               verticalement — on voit d'un coup ce que pèse le chariot.

               La case et le retrait restent aux extrémités, exactement où ils étaient : seule la
               mise en forme change, aucun geste ne se déplace. -->
          <UTable v-else :data="articlesDe(liste)" :columns="colonnesArticles">
            <template #choix-cell="{ row }">
              <UCheckbox
                v-if="canManage"
                :model-value="row.original.purchased"
                :disabled="
                  bascule.isLoading(cleArticle(liste.id, row.original.id, !row.original.purchased))
                "
                :ui="{ base: 'cursor-pointer' }"
                @update:model-value="basculerAchat(liste.id, row.original)"
              />
              <!-- Sans droit d’écriture, la case disparaît : l’état de l’achat, lui, doit rester
                   visible — c’est l’information, la case n’était que le moyen de la changer. -->
              <UIcon
                v-else
                :name="
                  row.original.purchased ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'
                "
                :class="row.original.purchased ? 'text-green-500' : 'text-gray-300'"
                class="size-5 shrink-0"
              />
            </template>
            <template #name-cell="{ row }">
              <span
                class="font-medium"
                :class="row.original.purchased ? 'line-through text-gray-400' : ''"
              >
                {{ row.original.item?.name ?? t('gestion.stock.shopping_item_gone') }}
              </span>
            </template>
            <template #group-cell="{ row }">
              <span class="text-sm text-gray-500">{{ row.original.item?.group?.name }}</span>
            </template>
            <template #tags-cell="{ row }">
              <div v-if="row.original.item?.tags?.length" class="flex flex-wrap gap-1">
                <StockTagBadge
                  v-for="assignation in row.original.item.tags"
                  :key="assignation.tag.id"
                  :tag="assignation.tag"
                  size="sm"
                />
              </div>
              <span v-else class="text-sm text-gray-400">—</span>
            </template>
            <template #quantite-cell="{ row }">
              <!-- Le manque a disparu depuis l'ajout : quelqu'un a recompté et retrouvé le
                   matériel. C'est du travail en moins, à condition de le voir. -->
              <UBadge
                v-if="articleSansObjet(row.original)"
                color="neutral"
                variant="subtle"
                :title="t('gestion.stock.shopping_no_longer_missing_hint')"
              >
                {{ t('gestion.stock.shopping_no_longer_missing') }}
              </UBadge>
              <UBadge v-else-if="quantiteDeLArticle(row.original)" color="error" variant="subtle">
                {{ quantiteDeLArticle(row.original) }}
              </UBadge>
              <span v-else class="text-sm text-gray-400">—</span>
            </template>
            <template #retrait-cell="{ row }">
              <UTooltip :text="t('gestion.stock.shopping_remove_item')">
                <UButton
                  icon="i-heroicons-x-mark"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :loading="retrait.isLoading(cleArticle(liste.id, row.original.id))"
                  @click="demanderRetrait(liste.id, row.original)"
                />
              </UTooltip>
            </template>
          </UTable>
        </UCard>
      </div>
    </div>

    <!-- Barre d'enregistrement du comptage : elle ne paraît que s'il y a quelque chose à écrire,
         et compte les saisies en attente pour qu'on ne quitte pas la page sans les enregistrer. -->
    <div
      v-if="canManage && enAttente > 0"
      class="sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-950"
    >
      <span class="text-sm">{{ t('gestion.stock.count_pending', { count: enAttente }) }}</span>
      <div class="flex gap-2">
        <UButton color="neutral" variant="ghost" size="sm" @click="saisies = {}">
          {{ t('common.cancel') }}
        </UButton>
        <UButton size="sm" :loading="comptageEnCours" @click="enregistrerComptage">
          {{ t('common.save') }}
        </UButton>
      </div>
    </div>

    <StockShoppingListModal
      v-model:open="modaleOuverte"
      :edition-id="editionId"
      :item-ids="itemIdsAVerser"
      :listes="listesSimples"
      :liste-a-renommer="listeARenommer"
      @saved="apresEnregistrement"
    />

    <!-- Le retrait d'un article passe par la même porte que la suppression d'une liste. La croix
         était irréversible et sans filet : rien ne rattrape un article retiré par erreur, il faut
         retrouver l'objet dans les manquants et le reverser — et sur un téléphone, en courses,
         elle est voisine de la case à cocher qu'on vise vraiment. -->
    <UiConfirmModal
      v-model="retraitConfirmationOuvert"
      :title="t('gestion.stock.shopping_remove_item')"
      :description="
        t('gestion.stock.shopping_remove_item_confirm', { name: nomDeLArticleARetirer })
      "
      :confirm-label="t('gestion.stock.shopping_remove_item')"
      confirm-color="error"
      :loading="retrait.loading.value"
      @confirm="confirmerRetrait"
      @cancel="retraitConfirmationOuvert = false"
    />

    <UiConfirmModal
      v-model="confirmationOuverte"
      :title="t('gestion.stock.shopping_delete_title')"
      :description="
        t('gestion.stock.shopping_delete_confirm', { name: listeASupprimer?.name ?? '' })
      "
      :confirm-label="t('common.delete')"
      confirm-color="error"
      :loading="suppressionListe.loading.value"
      @confirm="supprimerListe"
      @cancel="confirmationOuverte = false"
    />
  </UContainer>
</template>

<script setup lang="ts">
import { useAuthStore, useEditionStore } from '#imports'

import {
  comptagesAEnvoyer,
  compteRetenu,
  nombreEnAttente,
  type LigneComptage,
} from '../../../../../utils/comptage-stock'
import { listeEnCours } from '../../../../../utils/compteur-listes-de-courses'
import { peutGererLeStock } from '../../../../../utils/droits-stock'
import {
  filtrerParTags,
  tagsDepuisUrl,
  urlDepuisTags,
} from '../../../../../utils/filtre-tags-stock'
import { filtrerParGroupes } from '../../../../../utils/filtres-objets-stock'
import {
  articlesParTags,
  articleSansObjet,
  listesParObjet,
  listeTerminee,
  quantiteDeLArticle,
  resumeListe,
  type ArticleDeListe,
} from '../../../../../utils/liste-de-courses'
import {
  objetsARacheter,
  objetsNonComptes,
  quantiteARacheter,
  resumeRachat,
  type ObjetManquant,
} from '../../../../../utils/manquants-stock'
import { filtrerParNom } from '../../../../../utils/recherche-materiel'

import type {
  OptionGroupe,
  OptionTag,
} from '../../../../../components/stock/StockFiltresObjets.vue'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingFn } from '@tanstack/vue-table'

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const editionStore = useEditionStore()

const editionId = parseInt(route.params.id as string)

const edition = computed(() => editionStore.getEditionById(editionId))

/**
 * Peut-on écrire, ou seulement regarder&nbsp;?
 *
 * La page se lit avec le droit de CONSULTATION — celui qui va faire les courses n'est pas toujours
 * celui qui tient l'inventaire —, mais compter et tenir des listes demandent celui de GESTION.
 * Sans cette distinction, un consultant verrait des champs de saisie qui rendraient une 403 à
 * l'enregistrement, et croirait à un défaut.
 *
 * Le serveur décide seul : ceci ne fait que ne pas proposer ce qu'il refuserait.
 */
const canManage = computed(() =>
  peutGererLeStock(edition.value as any, authStore.user?.id, authStore.isAdminModeActive)
)

interface ListeDeCourses {
  id: number
  name: string
  createdAt: string
  items: ArticleDeListe[]
}

const objets = ref<ObjetManquant[]>([])
const listes = ref<ListeDeCourses[]>([])
const chargement = ref(true)
const ONGLETS = ['racheter', 'compter', 'listes'] as const
type Onglet = (typeof ONGLETS)[number]

/**
 * L'onglet ouvert vit dans l'URL.
 *
 * Sans cela, un lien partagé — « regarde ce qu'il reste à compter » — ramène toujours sur le
 * premier onglet, et revenir en arrière depuis une fiche rouvre la page au mauvais endroit. Un
 * onglet inconnu dans l'URL retombe sur le premier plutôt que d'afficher une page vide.
 */
const ongletActif = computed<Onglet>({
  get: () => {
    const demande = route.query.onglet
    return ONGLETS.includes(demande as Onglet) ? (demande as Onglet) : 'racheter'
  },
  set: (valeur) => {
    // `replace` et non `push` : changer d'onglet n'est pas une navigation dont on veut revenir par
    // le bouton « précédent », qui remonterait onglet par onglet avant de quitter la page.
    router.replace({
      query: { ...route.query, onglet: valeur === 'racheter' ? undefined : valeur },
    })
  },
})

/** Les saisies de la séance en cours, non encore enregistrées. Clé : identifiant de l'objet. */
const saisies = ref<Record<number, number | null>>({})
const comptageEnCours = ref(false)

/**
 * La sélection est celle du TABLEAU, pas une liste tenue à part.
 *
 * Les clés sont les identifiants des objets — voir `get-row-id` dans le template —, si bien que
 * réordonner ou filtrer la liste ne déplace pas ce qui est coché.
 */
const selectionLignes = ref<Record<string, boolean>>({})

const modaleOuverte = ref(false)
const itemIdsAVerser = ref<number[]>([])
const listeARenommer = ref<{ id: number; name: string } | null>(null)

const confirmationOuverte = ref(false)
const listeASupprimer = ref<ListeDeCourses | null>(null)

const retraitConfirmationOuvert = ref(false)
const articleARetirer = ref<{ listId: number; article: ArticleDeListe } | null>(null)

/**
 * Le nom à annoncer dans la demande de confirmation.
 *
 * Un article dont l'objet a disparu du stock n'a plus de nom à lui : la même mention que dans le
 * tableau le désigne alors, plutôt qu'un blanc qui ferait lire «&nbsp;«&nbsp;&nbsp;» sera retiré&nbsp;».
 */
const nomDeLArticleARetirer = computed(
  () => articleARetirer.value?.article.item?.name ?? t('gestion.stock.shopping_item_gone')
)

/**
 * Les objets, augmentés de ce qui vient d'être tapé.
 *
 * La saisie du jour prime sur l'enregistré — c'est ce qui fait qu'un objet corrigé change d'onglet
 * sous le curseur, sans attendre l'enregistrement.
 */
const lignes = computed<ObjetManquant[]>(() =>
  objets.value.map((objet) => ({
    ...objet,
    ...(objet.id in saisies.value ? { saisie: saisies.value[objet.id] } : {}),
  }))
)

/**
 * Où chaque objet est déjà prévu, lu dans les listes DÉJÀ chargées.
 *
 * Le troisième onglet a besoin du contenu des listes de toute façon : l'appartenance s'en déduit
 * sans une requête de plus, et se recalcule d'elle-même quand `chargerListes` rend la main après
 * un ajout ou un retrait — la colonne et le filtre suivent sans qu'on ait à y penser.
 */
const appartenances = computed(() => listesParObjet(listes.value))

const listesDeLObjet = (id: number) => appartenances.value.get(id) ?? []

/**
 * Ne montrer que ce qui n'est prévu nulle part.
 *
 * Sur une grosse édition, la moitié des manquants est déjà versée dans une liste au moment où l'on
 * revient sur la page : les relire une par une pour retrouver les quelques-unes qui restent est
 * exactement le travail que la colonne « Listes » permet d'éviter.
 *
 * Volontairement hors de l'URL, à la différence de l'onglet : c'est un réglage de coup d'œil, pas
 * un endroit vers lequel on envoie quelqu'un.
 */
const seulementHorsListe = ref(false)

/**
 * Les filtres, par onglet.
 *
 * Deux jeux et non un seul, pour la même raison que les deux états de tri : on ne cherche pas la
 * même chose selon qu'on décide d'un achat ou qu'on finit une séance de comptage. Garder un jeu
 * commun ferait aussi disparaître des lignes en changeant d'onglet, sans que rien à l'écran dise
 * qu'un filtre venu d'ailleurs est encore posé.
 */
const rechercheManquants = ref('')
const groupesManquants = ref<OptionGroupe[]>([])
const tagsManquants = ref<OptionTag[]>([])

const rechercheACompter = ref('')
const groupesACompter = ref<OptionGroupe[]>([])
const tagsACompter = ref<OptionTag[]>([])

// ⚠️ Ces déclarations doivent rester AU-DESSUS du `watch` qui suit. Elles vivaient plus bas, à
// côté des états de tri : un `watch` évalue sa source dès l'exécution du `setup`, pour enregistrer
// ses dépendances, et lisait donc des `const` pas encore initialisées. « Cannot access before
// initialization » — le `setup` échouait entier, et la page ne s'affichait plus du tout.

// Toucher à un filtre vide la sélection : ce qui est coché doit toujours être ce qu'on voit. Les
// clés de sélection survivent à la disparition d'une ligne — c'est voulu pour le recomptage —,
// si bien que sans cela on cocherait cinq objets, on poserait le filtre, et le bouton en verserait
// deux qu'on ne regardait plus dans la liste de courses.
//
// Les quatre ensemble, et pas seulement la case « hors liste » : la recherche, les groupes et les
// tags cachent des lignes exactement de la même façon. N'en surveiller qu'un laisserait le défaut
// entier, simplement déplacé sur les trois autres.
watch(
  [seulementHorsListe, rechercheManquants, groupesManquants, tagsManquants],
  () => {
    selectionLignes.value = {}
  },
  { deep: true }
)

const tousLesManquants = computed(() => objetsARacheter(lignes.value))

/**
 * Les trois filtres de la barre, appliqués dans l'ordre.
 *
 * Ils se composent en ET entre eux — « les marmites, en cuisine, qui sont fragiles » — chacun
 * restant un OU à l'intérieur. Aucun des trois n'est écrit ici : la recherche vient de
 * `recherche-materiel`, qui découpe la requête en mots, les groupes et les tags de leurs utils
 * respectifs. Les recopier aurait fait diverger cet écran de la liste d'un groupe et des
 * emprunts, sur des détails qu'on ne découvre qu'à l'usage.
 */
function appliquerFiltres<T extends ObjetManquant>(
  objets: T[],
  recherche: string,
  groupes: OptionGroupe[],
  tags: OptionTag[]
): T[] {
  const parNom = filtrerParNom(objets, recherche)
  const parGroupe = filtrerParGroupes(
    parNom,
    groupes.map((option) => option.value)
  )
  return filtrerParTags(
    parGroupe,
    tags.map((option) => option.value)
  )
}

const manquants = computed(() => {
  const horsListe = seulementHorsListe.value
    ? tousLesManquants.value.filter((objet) => listesDeLObjet(objet.id).length === 0)
    : tousLesManquants.value
  return appliquerFiltres(
    horsListe,
    rechercheManquants.value,
    groupesManquants.value,
    tagsManquants.value
  )
})

/** L'onglet avant filtrage : c'est sur lui que les listes déroulantes se construisent. */
const tousLesNonComptes = computed(() => objetsNonComptes(lignes.value))

const nonComptes = computed(() =>
  appliquerFiltres(
    tousLesNonComptes.value,
    rechercheACompter.value,
    groupesACompter.value,
    tagsACompter.value
  )
)
const resume = computed(() => resumeRachat(lignes.value))
const enAttente = computed(() => nombreEnAttente(lignes.value as LigneComptage[]))

/**
 * Le compte va DANS le libellé, comme sur la page des emprunts.
 *
 * `UTabs` n'expose pas de pastille sur ses éléments : une propriété `badge` y serait ignorée sans
 * rien signaler, et l'onglet afficherait un libellé nu qu'on croirait juste. Le compte est ici la
 * moitié de l'information — savoir combien d'objets restent à compter sans changer d'onglet.
 */
const onglets = computed(() => [
  {
    label: `${t('gestion.stock.missing_tab_buy')} (${resume.value.objetsManquants})`,
    value: 'racheter',
  },
  {
    label: `${t('gestion.stock.missing_tab_count')} (${resume.value.nonComptes})`,
    value: 'compter',
  },
  {
    label: `${t('gestion.stock.shopping_lists')} (${listes.value.length})`,
    value: 'listes',
  },
])

/**
 * L'ordre des lignes, par tableau.
 *
 * Par le NOM, et non par ce qui manque le plus, qui était pourtant l'ordre que `objetsARacheter`
 * pose et défend. Les deux réponses sont bonnes à des moments différents : chercher un objet
 * précis dans la liste demande l'alphabet, jauger la dépense demande le manque. Le second reste
 * à un clic, sur l'en-tête « À racheter » — c'est tout l'intérêt de rendre les colonnes triables
 * plutôt que d'arbitrer une fois pour toutes dans l'util.
 *
 * Deux états et non un seul : les deux onglets n'ont pas les mêmes colonnes, et un état partagé
 * ferait porter à l'un un tri que l'autre ne sait pas honorer — un `id` inconnu ne trie rien et
 * ne dit pas pourquoi.
 */
/**
 * Un filtre est-il posé ? Ce qui décide du message affiché sur un tableau vide.
 *
 * La case « hors liste » compte pour l'onglet des manquants : elle vide l'écran exactement comme
 * les trois autres, et le message ne doit pas annoncer que tout est prévu quand c'est elle qui
 * cache le reste.
 */
const filtresManquantsPoses = computed(
  () =>
    seulementHorsListe.value ||
    rechercheManquants.value.trim() !== '' ||
    groupesManquants.value.length > 0 ||
    tagsManquants.value.length > 0
)

const filtresACompterPoses = computed(
  () =>
    rechercheACompter.value.trim() !== '' ||
    groupesACompter.value.length > 0 ||
    tagsACompter.value.length > 0
)

const triManquants = ref<{ id: string; desc: boolean }[]>([{ id: 'name', desc: false }])
const triACompter = ref<{ id: string; desc: boolean }[]>([{ id: 'name', desc: false }])

/** En-tête cliquable, avec la flèche qui dit le sens du tri en cours. */
function enTeteTriable(column: Column<ObjetManquant>, libelle: string) {
  const trie = column.getIsSorted()
  return h(resolveComponent('UButton'), {
    color: 'neutral',
    variant: 'ghost',
    label: libelle,
    icon: trie
      ? trie === 'asc'
        ? 'i-lucide-arrow-up-narrow-wide'
        : 'i-lucide-arrow-down-wide-narrow'
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(trie === 'asc'),
  })
}

/**
 * Comparaison de deux textes à la française.
 *
 * Le tri par défaut de TanStack compare les chaînes caractère par caractère, sur leur code : « é »
 * y vaut 233, donc plus que n'importe quelle lettre non accentuée. Mesuré sur l'édition de
 * développement, 82 des 343 objets du stock portent un accent — « Sérum » se rangeait après
 * « Serviette », et « Éponge » après « Zébrure », en fin de liste. Ce n'est pas une subtilité de
 * linguiste : c'est un objet qu'on ne trouve pas là où on le cherche.
 *
 * `localeCompare` avec la locale française explicite, et non celle de l'utilisateur : ce sont des
 * noms de matériel saisis en français par l'équipe, quelle que soit la langue de l'interface.
 */
const triTexte: SortingFn<ObjetManquant> = (ligneA, ligneB, colonne) =>
  String(ligneA.getValue(colonne) ?? '').localeCompare(String(ligneB.getValue(colonne) ?? ''), 'fr')

/**
 * Ce sur quoi se trie la colonne « Compté », dans le tableau des manquants.
 *
 * Un NOMBRE, pas le texte de la case : `saisieAffichee` rend une chaîne, et 10 se serait rangé
 * avant 9.
 *
 * Le `?? undefined` ne devrait jamais servir — un objet n'est « manquant » que si `compteRetenu`
 * rend un nombre, c'est la définition qu'en donne `etatDeRachat`. Il est là pour que la colonne
 * tienne quand même si cet invariant bouge : `undefined` — et non `0` — parce que « pas compté »
 * n'est pas « zéro exemplaire », distinction que `saisir` défend déjà en enregistrant `null` sur
 * une case vidée. TanStack range les `undefined` en queue dans les deux sens : une absence de
 * réponse n'a pas de place dans un classement.
 */
function compteTriable(objet: ObjetManquant): number | undefined {
  return compteRetenu(objet) ?? undefined
}

const colonnesManquants = computed((): TableColumn<ObjetManquant>[] => {
  // `appartenances` est lu ICI, dans le corps du `computed`, et pas seulement dans l'accesseur
  // de la colonne « Listes ». Un accesseur s'exécute plus tard, hors de la portée où Vue relève
  // les dépendances : les colonnes n'auraient donc pas été reconstruites quand une liste de
  // courses change, et TanStack aurait gardé l'ordre calculé avant l'ajout. La pastille serait
  // apparue dans la bonne cellule — c'est un slot, il est réactif — mais la ligne ne se serait
  // pas déplacée, ce qui donne un tableau qui se contredit lui-même.
  const parObjet = appartenances.value

  return [
    // La colonne des cases : rien à y ordonner, et un en-tête cliquable y prendrait la place de
    // la coche « tout sélectionner ».
    ...(canManage.value ? [{ id: 'choix', header: '', enableSorting: false }] : []),
    {
      id: 'name',
      accessorKey: 'name',
      sortingFn: triTexte,
      header: ({ column }) => enTeteTriable(column, t('gestion.stock.item_name')),
    },
    {
      id: 'group',
      accessorFn: (objet) => objet.group.name,
      sortingFn: triTexte,
      header: ({ column }) => enTeteTriable(column, t('gestion.stock.group')),
    },
    {
      // Les tags après le groupe : le groupe dit OÙ l'objet est rangé, les tags CE QU'IL EST. En
      // lecture seule ici — ils se posent et se retirent sur la liste d'un groupe ; cet écran
      // décide d'un rachat ou finit un comptage, il ne trie pas l'inventaire.
      id: 'tags',
      accessorFn: (objet) => (objet.tags ?? []).map((lien) => lien.tag.name).join(', '),
      sortingFn: triTexte,
      header: ({ column }) => enTeteTriable(column, t('gestion.stock.tags.field_label')),
    },
    {
      id: 'quantity',
      accessorKey: 'quantity',
      header: ({ column }) => enTeteTriable(column, t('gestion.stock.count_expected')),
    },
    {
      id: 'compte',
      accessorFn: compteTriable,
      header: ({ column }) => enTeteTriable(column, t('gestion.stock.count_counted')),
    },
    {
      id: 'racheter',
      accessorFn: (objet) => quantiteARacheter(objet) ?? undefined,
      header: ({ column }) => enTeteTriable(column, t('gestion.stock.missing_to_buy')),
    },
    {
      // Le NOMBRE de listes, pas leurs noms : la question posée par cette colonne est « est-ce déjà
      // prévu quelque part », et trier sur le premier nom de liste n'y répondrait pas.
      id: 'listes',
      accessorFn: (objet) => (parObjet.get(objet.id) ?? []).length,
      header: ({ column }) => enTeteTriable(column, t('gestion.stock.missing_in_lists')),
    },
  ]
})

const colonnesACompter = computed((): TableColumn<ObjetManquant>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    sortingFn: triTexte,
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.item_name')),
  },
  {
    id: 'group',
    accessorFn: (objet) => objet.group.name,
    sortingFn: triTexte,
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.group')),
  },
  {
    // Les tags après le groupe : le groupe dit OÙ l'objet est rangé, les tags CE QU'IL EST. En
    // lecture seule ici — ils se posent et se retirent sur la liste d'un groupe ; cet écran
    // décide d'un rachat ou finit un comptage, il ne trie pas l'inventaire.
    id: 'tags',
    accessorFn: (objet) => (objet.tags ?? []).map((lien) => lien.tag.name).join(', '),
    sortingFn: triTexte,
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.tags.field_label')),
  },
  {
    id: 'quantity',
    accessorKey: 'quantity',
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.count_expected')),
  },
  {
    // Pas de tri ici, à la différence de l'autre onglet : un objet n'est dans cette liste que
    // parce que `compteRetenu` rend `null`, donc la colonne ne contient QUE des absences — et
    // dès qu'on en remplit une, la ligne quitte l'onglet. Un en-tête cliquable qui ne
    // réordonnerait jamais rien se lit comme une panne, pas comme une règle.
    id: 'compte',
    header: t('gestion.stock.count_counted'),
    enableSorting: false,
  },
])

/**
 * Les colonnes d'une liste de courses.
 *
 * La case et le retrait n'apparaissent qu'avec le droit d'écriture — l'état de l'achat, lui, reste
 * visible sans lui, à l'icône. Même règle que sur le tableau des manquants, d'où la même forme.
 *
 * `quantite` vient AVANT le nom, en deuxième colonne. C'est l'ordre du geste en rayon : on lit
 * d'abord combien il en faut, puis on cherche quoi — l'inverse oblige à revenir en arrière sur
 * chaque ligne. C'est aussi la colonne qu'on balaie verticalement pour jauger le chariot, et elle
 * se balaie mieux près du bord qu'au milieu du tableau.
 */
const colonnesArticles = computed((): TableColumn<ArticleDeListe>[] => [
  { id: 'choix', header: '' },
  {
    id: 'quantite',
    header: t('gestion.stock.missing_to_buy'),
    // `w-px` ne fait pas un pixel de large : sur un tableau à largeurs automatiques, une largeur
    // déclarée plus petite que le contenu revient à demander la colonne la plus étroite possible,
    // et le navigateur s'arrête à ce que le contenu impose. Sans cela la colonne prenait sa part
    // de l'espace libre et un badge de deux chiffres flottait au milieu d'un vide. `whitespace-
    // nowrap` empêche la contrepartie : à se rétrécir, l'en-tête se serait cassé en deux lignes.
    meta: { class: { th: 'w-px whitespace-nowrap', td: 'w-px whitespace-nowrap' } },
  },
  { id: 'name', header: t('gestion.stock.item_name') },
  { id: 'group', header: t('gestion.stock.group') },
  { id: 'tags', header: t('gestion.stock.tags.field_label') },
  ...(canManage.value ? [{ id: 'retrait', header: '' }] : []),
])

/**
 * Quelle liste de courses est ouverte, d'après l'URL.
 *
 * Dans l'URL et non dans une simple variable, pour la même raison que l'onglet : on envoie un lien
 * à quelqu'un — «&nbsp;voilà ce qu'il reste à prendre à la quincaillerie&nbsp;» — et il doit s'ouvrir sur
 * cette liste-là.
 *
 * ⚠️ La lecture RETOMBE toujours sur une liste qui existe. Une URL peut désigner une liste
 * supprimée depuis — par un lien d'hier, ou parce qu'on vient soi-même de la supprimer —, et s'y
 * fier aveuglément n'afficherait rien du tout, sans rien dire. La plus récente prend alors le
 * relais : c'est aussi ce qui donne le comportement par défaut, URL nue comprise.
 */
const listeChoisieId = computed<number | null>({
  get: () => {
    if (listes.value.length === 0) return null
    const demandee = Number(route.query.liste)
    const existe = listes.value.some((liste) => liste.id === demandee)
    return existe ? demandee : (listes.value[0]?.id ?? null)
  },
  set: (valeur) => {
    // `replace` et non `push` : dérouler un sélecteur n'est pas une navigation dont on veut
    // revenir liste par liste avec le bouton «&nbsp;précédent&nbsp;» avant de quitter la page.
    //
    // Les tags repartent à zéro : ils décrivent le contenu d'UNE liste, et les traîner sur la
    // suivante donnait un tableau amputé par un filtre dont plus rien ne montrait qu'il agissait.
    // Dans la même navigation, et non dans un `watch` séparé : deux `replace` consécutifs se
    // recouvrent, et le second repartirait d'un état d'URL périmé.
    router.replace({
      query: { ...route.query, liste: valeur ? String(valeur) : undefined, tags: undefined },
    })
  },
})

/**
 * La liste à afficher, dans un tableau d'au plus un élément.
 *
 * Le modèle itère dessus plutôt que de tester sa présence : voir le commentaire au-dessus de la
 * carte.
 */
const listesAffichees = computed(() =>
  listes.value.filter((liste) => liste.id === listeChoisieId.value)
)

const optionsDeListes = computed(() =>
  listes.value.map((liste) => ({ label: liste.name, value: liste.id }))
)

/**
 * Les tags qui filtrent la liste ouverte, portés par l'URL.
 *
 * Même lecture tolérante que sur l'inventaire — valeurs absentes, doublons, entrées non
 * numériques — et même écriture, qui retire le paramètre plutôt que de laisser traîner un
 * `?tags=` vide dans une adresse qu'on partage.
 */
const tagsChoisis = computed<number[]>({
  get: () => tagsDepuisUrl(route.query.tags),
  set: (valeur) => {
    router.replace({ query: { ...route.query, tags: urlDepuisTags(valeur) } })
  },
})

/**
 * Les pastilles proposées au filtre : celles qui figurent dans la liste ouverte, et elles seules.
 *
 * Tirées des articles plutôt que demandées au serveur — aucun appel de plus — et calculées AVANT
 * filtrage : les prendre après ferait disparaître du menu les tags qu'on vient de décocher, et
 * l'on ne pourrait plus revenir en arrière. Proposer les tags de toute l'édition n'aurait pas
 * servi non plus : la moitié ne rendrait rien sur cette liste-ci.
 */
const optionsDeTags = computed(() => {
  const vus = new Map<number, { label: string; value: number; color: string }>()

  for (const liste of listesAffichees.value) {
    for (const article of liste.items) {
      for (const { tag } of article.item?.tags ?? []) {
        if (!vus.has(tag.id)) vus.set(tag.id, { label: tag.name, value: tag.id, color: tag.color })
      }
    }
  }

  return [...vus.values()].sort((a, b) => a.label.localeCompare(b.label))
})

/**
 * Les tags qui filtrent VRAIMENT : ceux que l'URL demande ET que la liste ouverte propose.
 *
 * ⚠️ Ce croisement n'est pas une précaution théorique. Sans lui, un tag absent de la liste ouverte
 * restait actif tout en étant introuvable dans le menu : le tableau se vidait et rien n'expliquait
 * pourquoi. Le cas arrivait en changeant de liste, et il arrive encore par un lien reçu qui désigne
 * un tag disparu depuis — que le sélecteur remette le filtre à zéro ne suffit donc pas.
 *
 * C'est cette valeur, et non celle de l'URL, que lisent le tableau comme le menu : une seule source
 * pour ce qui s'affiche et ce qui filtre, faute de quoi les deux se contrediraient à nouveau.
 */
const tagsActifs = computed(() => {
  const proposes = new Set(optionsDeTags.value.map((option) => option.value))
  return tagsChoisis.value.filter((id) => proposes.has(id))
})

/**
 * Les pastilles cochées, sous la forme que `USelectMenu` manipule.
 *
 * Le menu travaille sur les options elles-mêmes, l'URL sur des identifiants : ce va-et-vient les
 * raccorde.
 */
const tagsSelectionnes = computed({
  get: () => optionsDeTags.value.filter((option) => tagsActifs.value.includes(option.value)),
  set: (options: { value: number }[]) => {
    tagsChoisis.value = options.map((option) => option.value)
  },
})

/** Les articles de la liste ouverte, une fois les pastilles appliquées. */
const articlesDe = (liste: ListeDeCourses) => articlesParTags(liste.items, tagsActifs.value)

const listesSimples = computed(() => listes.value.map(({ id, name }) => ({ id, name })))

/**
 * Combien de listes attendent encore des achats.
 *
 * La même règle que la pastille du menu, et non un calcul refait ici : les deux chiffres doivent
 * dire la même chose, sans quoi l'un contredit l'autre sous les yeux de l'utilisateur.
 */
const listesEnCours = computed(() => listes.value.filter(listeEnCours).length)

const resumeDe = (liste: ListeDeCourses) => resumeListe(liste.items)

/** Ce que la case affiche : la saisie du jour, sinon l'enregistré, sinon rien. */
function saisieAffichee(id: number): string {
  const ligne = lignes.value.find((l) => l.id === id)
  const compte = compteRetenu(ligne ?? { id, quantity: 0, finalQuantity: null })
  return compte === null ? '' : String(compte)
}

/**
 * Enregistre une frappe dans la séance, sans rien envoyer.
 *
 * Une case vidée vaut `null` et non zéro : c'est le geste qui efface un comptage écrit par erreur,
 * et le confondre avec « zéro exemplaire » ferait disparaître du matériel sur le papier. Même
 * règle que sur la page d'un groupe, d'où l'util partagé.
 */
function saisir(id: number, valeur: string | number) {
  const texte = String(valeur).trim()
  if (texte === '') {
    saisies.value = { ...saisies.value, [id]: null }
    return
  }
  const nombre = Number(texte)
  if (!Number.isFinite(nombre) || nombre < 0) return
  saisies.value = { ...saisies.value, [id]: Math.floor(nombre) }
}

/** Les identifiants cochés, dans l'ordre où le tableau les porte. */
const identifiantsSelectionnes = computed(() =>
  Object.entries(selectionLignes.value)
    .filter(([, coche]) => coche)
    .map(([id]) => Number(id))
)

function ouvrirAjout() {
  itemIdsAVerser.value = [...identifiantsSelectionnes.value]
  listeARenommer.value = null
  modaleOuverte.value = true
}

function ouvrirCreationVide() {
  itemIdsAVerser.value = []
  listeARenommer.value = null
  modaleOuverte.value = true
}

function ouvrirRenommage(liste: ListeDeCourses) {
  itemIdsAVerser.value = []
  listeARenommer.value = { id: liste.id, name: liste.name }
  modaleOuverte.value = true
}

async function apresEnregistrement(listeId?: number) {
  selectionLignes.value = {}
  await chargerListes()
  // Ouvrir la liste qui vient de recevoir le matériel : sans cela on basculerait sur l'onglet des
  // listes pour y regarder une AUTRE liste que celle qu'on vient de remplir.
  if (listeId) listeChoisieId.value = listeId
  ongletActif.value = 'listes'
}

/**
 * La clé d'une action sur un article.
 *
 * Composite, parce que la route a besoin des deux identifiants et le corps de l'état voulu. Tout
 * faire tenir dans la clé évite une variable partagée entre le clic et la requête, qui se
 * mélangerait si l'on cochait deux lignes coup sur coup.
 */
function cleArticle(listId: number, articleId: number, achete?: boolean): string {
  return achete === undefined
    ? `${listId}:${articleId}`
    : `${listId}:${articleId}:${achete ? 1 : 0}`
}

const bascule = useApiActionById(
  (cle) => {
    const [listId, articleId] = String(cle).split(':')
    return `/api/editions/${editionId}/stock-shopping-lists/${listId}/items/${articleId}`
  },
  {
    method: 'PATCH',
    body: (cle) => ({ purchased: String(cle).split(':')[2] === '1' }),
    silentSuccess: true,
    errorMessages: { default: t('gestion.stock.shopping_list_error') },
    onSuccess: () => chargerListes(),
  }
)

const retrait = useApiActionById(
  (cle) => {
    const [listId, articleId] = String(cle).split(':')
    return `/api/editions/${editionId}/stock-shopping-lists/${listId}/items/${articleId}`
  },
  {
    method: 'DELETE',
    silentSuccess: true,
    errorMessages: { default: t('gestion.stock.shopping_list_error') },
    onSuccess: () => chargerListes(),
  }
)

const suppressionListe = useApiActionById(
  (listId) => `/api/editions/${editionId}/stock-shopping-lists/${listId}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.stock.shopping_list_deleted') },
    errorMessages: { default: t('gestion.stock.shopping_list_error') },
    onSuccess: () => chargerListes(),
  }
)

function basculerAchat(listId: number, article: ArticleDeListe) {
  bascule.execute(cleArticle(listId, article.id, !article.purchased))
}

function demanderRetrait(listId: number, article: ArticleDeListe) {
  articleARetirer.value = { listId, article }
  retraitConfirmationOuvert.value = true
}

async function confirmerRetrait() {
  // `UiConfirmModal` n'émet que `confirm` et `cancel` : la refermer revient à l'appelant.
  const demande = articleARetirer.value
  if (demande) await retrait.execute(cleArticle(demande.listId, demande.article.id))
  retraitConfirmationOuvert.value = false
  articleARetirer.value = null
}

function demanderSuppression(liste: ListeDeCourses) {
  listeASupprimer.value = liste
  confirmationOuverte.value = true
}

async function supprimerListe() {
  // `UiConfirmModal` n'émet que `confirm` et `cancel` : la refermer revient à l'appelant.
  const liste = listeASupprimer.value
  if (liste) await suppressionListe.execute(liste.id)
  confirmationOuverte.value = false
  listeASupprimer.value = null

  // L'affichage se remet seul — le getter retombe sur la plus récente quand l'URL désigne une
  // liste disparue. L'URL, elle, resterait fausse, et c'est elle qu'on envoie à quelqu'un.
  if (liste && Number(route.query.liste) === liste.id) {
    listeChoisieId.value = listes.value[0]?.id ?? null
  }
}

async function enregistrerComptage() {
  const comptage = comptagesAEnvoyer(lignes.value as LigneComptage[])
  if (comptage.length === 0) return

  comptageEnCours.value = true
  try {
    await $fetch(`/api/editions/${editionId}/stock-items/bulk`, {
      method: 'PATCH',
      body: { itemIds: comptage.map((entree) => entree.id), comptage },
    })
    useToast().add({
      title: t('common.saved'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    saisies.value = {}
    // Les listes aussi : une quantité y est relue sur l'objet, et un comptage vient de la changer.
    await Promise.all([chargerObjets(), chargerListes()])
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    comptageEnCours.value = false
  }
}

async function chargerObjets() {
  const reponse = await $fetch<{ data: { items: ObjetManquant[] } }>(
    `/api/editions/${editionId}/stock-comptage`
  )
  objets.value = reponse.data?.items ?? []
}

async function chargerListes() {
  const reponse = await $fetch<{ data: { lists: ListeDeCourses[] } }>(
    `/api/editions/${editionId}/stock-shopping-lists`
  )
  listes.value = reponse.data?.lists ?? []

  // La pastille du menu compte les listes non terminées : cocher un article, en ajouter ou
  // supprimer une liste la change. Le menu ne recalcule qu'au montage, c'est donc ici qu'il faut
  // le lui dire — et de façon CIBLÉE : un rafraîchissement complet effacerait les compteurs des
  // autres modules, qui ne sont pas rechargés ici.
  await rafraichirCompteursNavigation({ editionId }, ['stock-courses'])
}

onMounted(async () => {
  try {
    // L'édition d'abord : c'est elle qui dit si l'on peut écrire, et l'écran doit le savoir avant
    // d'afficher des champs de saisie.
    await editionStore.fetchEditionById(editionId, { force: true })
    await Promise.all([chargerObjets(), chargerListes()])
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    chargement.value = false
  }
})
</script>
