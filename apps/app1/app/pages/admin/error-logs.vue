<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" :aria-label="$t('navigation.breadcrumb')">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">{{
              $t('admin.api_error_logs')
            }}</span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-8">
      <!-- Titre et actions sur une même ligne : les deux libellés de boutons sont insécables
           (le thème leur applique `truncate`, donc white-space: nowrap) et réclamaient à eux
           seuls plus que la largeur d'un téléphone. Ils passent sous le titre en dessous de sm. -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <UIcon name="i-heroicons-exclamation-triangle" class="text-red-600 shrink-0" />
            <span class="break-words">{{ $t('admin.api_error_logs') }}</span>
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-2">
            Surveillance et résolution des erreurs de l'API
          </p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row sm:shrink-0">
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="outline"
            class="w-full justify-center sm:w-auto"
            :loading="cleaningOldLogs"
            @click="cleanupOldLogs"
          >
            Nettoyer logs > 1 mois
          </UButton>
          <UButton
            icon="i-heroicons-arrow-path"
            variant="outline"
            class="w-full justify-center sm:w-auto"
            :loading="loading"
            @click="refreshLogs"
          >
            Actualiser
          </UButton>
        </div>
      </div>
    </div>

    <!-- Statistiques rapides -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
      <UCard>
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400 break-words">
              {{ $t('admin.errors_24h') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats.totalLast24h }}
            </p>
          </div>
          <UIcon name="i-heroicons-clock" class="h-8 w-8 text-blue-500 shrink-0" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400 break-words">
              {{ $t('admin.unresolved') }}
            </p>
            <p class="text-2xl font-bold text-red-600">
              {{ stats.unresolvedCount }}
            </p>
          </div>
          <UIcon name="i-heroicons-exclamation-circle" class="h-8 w-8 text-red-500 shrink-0" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400 break-words">
              {{ $t('admin.main_type') }}
            </p>
            <p class="text-lg font-bold text-gray-900 dark:text-white">
              {{ stats.errorTypes[0]?.type || 'N/A' }}
            </p>
            <p class="text-xs text-gray-500">{{ stats.errorTypes[0]?.count || 0 }} occurrences</p>
          </div>
          <UIcon name="i-heroicons-bug-ant" class="h-8 w-8 text-yellow-500 shrink-0" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400 break-words">
              Code d'erreur principal
            </p>
            <p class="text-lg font-bold text-gray-900 dark:text-white">
              {{ stats.statusCodes[0]?.code || 'N/A' }}
            </p>
            <p class="text-xs text-gray-500">{{ stats.statusCodes[0]?.count || 0 }} occurrences</p>
          </div>
          <UIcon name="i-heroicons-signal-slash" class="h-8 w-8 text-purple-500 shrink-0" />
        </div>
      </UCard>
    </div>

    <!-- Filtres : en carte à partir de md, dans une fenêtre en dessous. Huit champs empilés
         mangeaient la hauteur d'un écran de téléphone avant même d'atteindre le tableau. -->
    <UCard class="mb-6 hidden md:block">
      <AdminErrorLogFilters
        v-model:filters="filters"
        :status-options="statusOptions"
        :time-range-options="timeRangeOptions"
        :error-type-options="errorTypeOptions"
        :status-code-options="statusCodeOptions"
        @apply="applyFilters"
        @search="debouncedSearch"
        @clear="clearFilters"
      />
    </UCard>

    <div class="mb-6 md:hidden">
      <UButton
        icon="i-heroicons-funnel"
        variant="outline"
        color="neutral"
        block
        @click="showFilters = true"
      >
        {{ $t('admin.error_logs.filters') }}
        <!-- Le compte évite d'avoir à ouvrir la fenêtre pour savoir si un filtre est actif. -->
        <UBadge v-if="activeFilterCount > 0" color="primary" size="sm" variant="solid">
          {{ activeFilterCount }}
        </UBadge>
      </UButton>
    </div>

    <UModal v-model:open="showFilters" :title="$t('admin.error_logs.filters')">
      <template #body>
        <AdminErrorLogFilters
          v-model:filters="filters"
          :status-options="statusOptions"
          :time-range-options="timeRangeOptions"
          :error-type-options="errorTypeOptions"
          :status-code-options="statusCodeOptions"
          @apply="applyFilters"
          @search="debouncedSearch"
          @clear="clearFilters"
        />
      </template>
      <template #footer>
        <UButton block @click="showFilters = false">
          {{ $t('admin.error_logs.show_results', { count: pagination.total }) }}
        </UButton>
      </template>
    </UModal>

    <!-- Table des logs -->
    <UCard>
      <div class="overflow-hidden">
        <!-- En-tête du tableau -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex flex-wrap justify-between items-center gap-3">
            <h3 class="text-lg font-medium flex flex-wrap items-center gap-2">
              {{ $t('admin.error_logs.title') }}
              <!-- Le total peut être un minorant quand le comptage a échoué : on le dit, plutôt
                   que d'afficher un nombre inventé comme s'il était sûr. -->
              <UBadge v-if="!vueGroupee" color="neutral" variant="soft">
                {{
                  totalExact
                    ? pagination.total
                    : $t('admin.error_logs.at_least', { count: pagination.total })
                }}
              </UBadge>
              <!-- La période effectivement appliquée. Elle dépendait auparavant du filtre de
                   statut, sans que rien ne l'indique. -->
              <UBadge color="neutral" variant="outline">
                {{ libellePeriodeActive }}
              </UBadge>
            </h3>
            <div class="flex flex-wrap items-center gap-4">
              <!-- Regroupées / à plat. Le regroupement était déjà présupposé par l'action
                   « résoudre les identiques » sans que l'écran le montre jamais. -->
              <UFieldGroup>
                <UButton
                  :color="vueGroupee ? 'primary' : 'neutral'"
                  :variant="vueGroupee ? 'solid' : 'outline'"
                  icon="i-heroicons-rectangle-stack"
                  :label="$t('admin.error_logs.view_grouped')"
                  @click="changerDeVue(true)"
                />
                <UButton
                  :color="vueGroupee ? 'neutral' : 'primary'"
                  :variant="vueGroupee ? 'outline' : 'solid'"
                  icon="i-heroicons-bars-3"
                  :label="$t('admin.error_logs.view_flat')"
                  @click="changerDeVue(false)"
                />
              </UFieldGroup>
              <!-- Sélecteur de colonnes visibles -->
              <UDropdownMenu
                v-if="!vueGroupee && logs.length"
                :items="columnVisibilityItems"
                :content="{ align: 'end' }"
              >
                <UButton
                  icon="i-heroicons-view-columns"
                  color="neutral"
                  variant="outline"
                  :label="$t('admin.error_logs.columns_label')"
                />
              </UDropdownMenu>
              <!-- Sélecteur de taille de page -->
              <USelect
                v-model="pagination.pageSize"
                :items="pageSizeOptions"
                class="w-20"
                @change="changePageSize"
              />
              <span class="text-sm text-gray-500">{{ $t('admin.per_page') }}</span>
            </div>
          </div>
        </div>

        <!-- Liste des logs -->
        <div v-if="loading" class="p-8 text-center">
          <UIcon
            name="i-heroicons-arrow-path"
            class="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400"
          />
          <p class="text-gray-500">{{ $t('admin.loading_logs') }}</p>
        </div>

        <!-- L'état vide de la liste À PLAT, et d'elle seule : la vue groupée ne remplit pas `logs`,
             si bien que cette condition l'aurait masquée en permanence. -->
        <div v-else-if="!vueGroupee && logs.length === 0" class="p-8 text-center">
          <UIcon name="i-heroicons-check-circle" class="h-12 w-12 text-green-400 mx-auto mb-4" />
          <p class="text-gray-500 mb-2">{{ $t('admin.no_errors_found') }}</p>
          <p class="text-sm text-gray-400">{{ $t('admin.good_news') }}</p>
        </div>

        <!-- Vue GROUPÉE : un problème par ligne, pas un événement.
             Le compteur, la première et la dernière vue sont ce qui décide de l'urgence — « ça
             continue » et « ça vient d'apparaître » ne se distinguaient pas dans une liste à plat. -->
        <div v-else-if="vueGroupee" class="divide-y divide-gray-200 dark:divide-gray-700">
          <div v-for="groupe in groupes" :key="groupe.empreinte" class="px-6 py-3">
            <div class="flex flex-wrap items-start gap-3">
              <UButton
                :icon="
                  empreinteDepliee === groupe.empreinte
                    ? 'i-heroicons-chevron-down'
                    : 'i-heroicons-chevron-right'
                "
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-expanded="empreinteDepliee === groupe.empreinte"
                :aria-label="$t('admin.error_logs.show_occurrences')"
                @click="basculerLeGroupe(groupe)"
              />

              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge color="neutral" variant="soft" class="font-mono text-xs">
                    {{ groupe.method }} {{ groupe.path }}
                  </UBadge>
                  <UBadge color="neutral" variant="outline" class="text-xs">
                    {{ libelleDuType(groupe.errorType) }}
                  </UBadge>
                </div>
                <p class="text-sm text-gray-900 dark:text-gray-100 break-words">
                  {{ groupe.message }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{
                    $t('admin.error_logs.seen_between', {
                      premiere: formatDateTime(groupe.premiereVue),
                      derniere: formatDateTime(groupe.derniereVue),
                    })
                  }}
                </p>
              </div>

              <div class="flex items-center gap-2">
                <UBadge color="primary" variant="subtle">
                  {{ $t('admin.error_logs.occurrences', { count: groupe.occurrences }) }}
                </UBadge>
                <UButton
                  icon="i-heroicons-check-badge"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :label="$t('admin.error_logs.action_resolve_similar')"
                  @click="demanderResolutionDesSimilaires(groupe)"
                />
              </div>
            </div>

            <!-- Les occurrences, chargées seulement au dépliage : on ne paie que ce qu'on regarde. -->
            <div v-if="empreinteDepliee === groupe.empreinte" class="mt-3 ml-9">
              <p v-if="occurrencesEnCours" class="text-sm text-gray-500">
                {{ $t('admin.loading_logs') }}
              </p>
              <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
                <li
                  v-for="occurrence in occurrences"
                  :key="occurrence.id"
                  class="flex flex-wrap items-center justify-between gap-2 py-2 cursor-pointer"
                  @click="showLogDetails(occurrence)"
                >
                  <span class="text-xs text-gray-600 dark:text-gray-400">
                    {{ formatDateTime(occurrence.createdAt) }}
                  </span>
                  <span class="flex items-center gap-2">
                    <UBadge
                      :color="getStatusCodeColor(occurrence.statusCode)"
                      variant="subtle"
                      size="xs"
                    >
                      {{ occurrence.statusCode }}
                    </UBadge>
                    <UBadge
                      :color="occurrence.resolved ? 'success' : 'warning'"
                      variant="soft"
                      size="xs"
                    >
                      {{
                        occurrence.resolved
                          ? $t('admin.error_logs.resolved')
                          : $t('admin.error_logs.unresolved_short')
                      }}
                    </UBadge>
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div v-if="groupes.length === 0" class="p-8 text-center">
            <UIcon name="i-heroicons-check-circle" class="h-12 w-12 text-green-400 mx-auto mb-4" />
            <p class="text-gray-500">{{ $t('admin.no_errors_found') }}</p>
          </div>
        </div>

        <UContextMenu v-else :items="contextMenuItems">
          <UTable
            ref="table"
            :data="logs"
            :columns="columns"
            class="w-full"
            :ui="{ tr: 'cursor-pointer' }"
            @select="onRowSelect"
            @contextmenu="onRowContextmenu"
          >
            <!-- Statut (résolu / non résolu) -->
            <template #status-cell="{ row }">
              <UIcon
                :name="
                  row.original.resolved
                    ? 'i-heroicons-check-circle'
                    : 'i-heroicons-exclamation-circle'
                "
                class="h-5 w-5"
                :class="row.original.resolved ? 'text-green-500' : 'text-red-500'"
                :title="
                  row.original.resolved
                    ? $t('admin.error_logs.resolved')
                    : $t('admin.error_logs.unresolved_short')
                "
              />
            </template>

            <!-- Date (triable) -->
            <template #createdAt-header>
              <UButton
                :label="$t('admin.error_logs.col_date')"
                :icon="sortIcon('createdAt')"
                color="neutral"
                variant="ghost"
                size="xs"
                class="-mx-1.5"
                @click="toggleSort('createdAt')"
              />
            </template>
            <template #createdAt-cell="{ row }">
              <div class="whitespace-nowrap">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ formatRelative(row.original.createdAt) }}
                </p>
                <p class="text-xs text-gray-500">{{ formatDateTime(row.original.createdAt) }}</p>
              </div>
            </template>

            <!-- Code HTTP (triable) -->
            <template #statusCode-header>
              <UButton
                :label="$t('admin.error_logs.col_code')"
                :icon="sortIcon('statusCode')"
                color="neutral"
                variant="ghost"
                size="xs"
                class="-mx-1.5"
                @click="toggleSort('statusCode')"
              />
            </template>
            <template #statusCode-cell="{ row }">
              <UBadge :color="getStatusCodeColor(row.original.statusCode)" variant="subtle">
                {{ row.original.statusCode }}
              </UBadge>
            </template>

            <!-- Type d'erreur -->
            <template #errorType-cell="{ row }">
              <UBadge v-if="row.original.errorType" color="neutral" variant="outline">
                {{ row.original.errorType }}
              </UBadge>
              <span v-else class="text-gray-400">—</span>
            </template>

            <!-- Endpoint (méthode + path, triable par path) -->
            <template #endpoint-header>
              <UButton
                :label="$t('admin.error_logs.col_endpoint')"
                :icon="sortIcon('path')"
                color="neutral"
                variant="ghost"
                size="xs"
                class="-mx-1.5"
                @click="toggleSort('path')"
              />
            </template>
            <template #endpoint-cell="{ row }">
              <div class="flex items-center gap-2 whitespace-nowrap">
                <UBadge color="neutral" variant="soft" size="sm">{{ row.original.method }}</UBadge>
                <code class="text-xs text-gray-600 dark:text-gray-300" :title="row.original.path">
                  {{ row.original.path }}
                </code>
              </div>
            </template>

            <!-- Message -->
            <template #message-cell="{ row }">
              <p
                class="max-w-md truncate text-sm text-gray-900 dark:text-white"
                :title="row.original.message"
              >
                {{ row.original.message }}
              </p>
            </template>

            <!-- Utilisateur -->
            <template #user-cell="{ row }">
              <!-- Lien vers la fiche : la recherche des utilisateurs accepte l'identifiant, ce
                   qui évite d'avoir à retrouver quelqu'un par son pseudo depuis une erreur. -->
              <ULink
                v-if="row.original.user"
                :to="`/admin/users?search=${row.original.user.id}`"
                class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                {{ row.original.user.pseudo }}
              </ULink>
              <span v-else class="text-sm italic text-gray-400">
                {{ $t('admin.error_logs.anonymous') }}
              </span>
            </template>

            <!-- Page d'origine (referer) -->
            <template #referer-cell="{ row }">
              <a
                v-if="row.original.referer"
                :href="row.original.referer"
                target="_blank"
                rel="noopener"
                class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                :title="row.original.referer"
                @click.stop
              >
                {{ truncateUrl(row.original.referer, 40) }}
              </a>
              <span v-else class="text-gray-400">—</span>
            </template>

            <!-- IP -->
            <template #ip-cell="{ row }">
              <span
                v-if="row.original.ip"
                class="font-mono text-xs text-gray-600 dark:text-gray-300"
              >
                {{ row.original.ip }}
              </span>
              <span v-else class="text-gray-400">—</span>
            </template>

            <!-- Actions -->
            <template #actions-cell="{ row }">
              <UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }">
                <UButton
                  icon="i-heroicons-ellipsis-vertical"
                  color="neutral"
                  variant="ghost"
                  square
                  @click.stop
                />
              </UDropdownMenu>
            </template>
          </UTable>
        </UContextMenu>

        <!-- Pagination -->
        <div
          v-if="!vueGroupee && pagination.totalPages > 1"
          class="px-6 py-4 border-t border-gray-200 dark:border-gray-700"
        >
          <UPagination
            v-model:page="pagination.page"
            :total="pagination.total"
            :items-per-page="pagination.pageSize"
            @update:page="changePage"
          />
        </div>

        <!-- Pagination de la vue groupée : par PAGE suivante/précédente et non par numéros.
             Le nombre total de groupes exigerait de tous les parcourir, et un compte approximatif
             affiché comme un total est précisément le défaut qu'on vient de corriger ailleurs. -->
        <div
          v-if="vueGroupee && (pagination.page > 1 || groupesOntUneSuite)"
          class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3"
        >
          <UButton
            color="neutral"
            variant="outline"
            icon="i-heroicons-arrow-left"
            :disabled="pagination.page <= 1"
            :label="$t('common.previous')"
            @click="changePage(pagination.page - 1)"
          />
          <span class="text-sm text-gray-500">
            {{ $t('admin.error_logs.page_number', { page: pagination.page }) }}
          </span>
          <UButton
            color="neutral"
            variant="outline"
            trailing-icon="i-heroicons-arrow-right"
            :disabled="!groupesOntUneSuite"
            :label="$t('common.next')"
            @click="changePage(pagination.page + 1)"
          />
        </div>
      </div>
    </UCard>

    <!-- Slideover de détails -->
    <USlideover
      v-model:open="showLogDetails"
      :title="$t('admin.error_details')"
      side="left"
      :ui="{ content: 'w-full max-w-3xl' }"
    >
      <template #body>
        <div v-if="selectedLog" class="space-y-6">
          <!-- Date et heure -->
          <p class="text-sm text-gray-500 mb-4">
            {{ formatDateTime(selectedLog.createdAt) }}
          </p>

          <!-- Informations principales -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Code de statut
              </label>
              <UBadge :color="getStatusCodeColor(selectedLog.statusCode)">
                {{ selectedLog.statusCode }}
              </UBadge>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type d'erreur
              </label>
              <UBadge color="neutral" variant="outline">
                {{ selectedLog.errorType || 'Non défini' }}
              </UBadge>
            </div>
          </div>

          <!-- Message d'erreur -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message d'erreur
            </label>
            <UTextarea
              :model-value="selectedLog.message"
              readonly
              :rows="3"
              variant="outline"
              class="w-full"
            />
          </div>

          <!-- Détails de la requête -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ $t('admin.error_logs.request_details') }}
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded break-words">
                <strong>{{ $t('log.method') }}:</strong> {{ selectedLog.method }}
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded break-words">
                <strong>{{ $t('log.path') }}:</strong> {{ selectedLog.path }}
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded sm:col-span-2 break-words">
                <strong>{{ $t('log.full_url') }}:</strong> {{ selectedLog.url }}
              </div>
              <div
                v-if="selectedLog.ip"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded break-words"
              >
                <strong>{{ $t('log.ip') }}:</strong> {{ selectedLog.ip }}
              </div>
              <div
                v-if="selectedLog.user"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded break-words"
              >
                <strong>{{ $t('log.user') }}:</strong> {{ selectedLog.user.pseudo }} ({{
                  selectedLog.user.email
                }})
              </div>
              <div
                v-if="selectedLog.referer"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded sm:col-span-2 break-words"
              >
                <strong>{{ $t('admin.error_logs.referer_page') }}</strong>
                <a
                  :href="selectedLog.referer"
                  target="_blank"
                  class="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {{ selectedLog.referer }}
                </a>
              </div>
              <div
                v-if="selectedLog.origin"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded sm:col-span-2 break-words"
              >
                <strong>{{ $t('admin.error_logs.origin_domain') }}</strong> {{ selectedLog.origin }}
              </div>
            </div>
          </div>

          <!-- Body POST/PUT si disponible -->
          <div v-if="selectedLog.body && Object.keys(selectedLog.body).length > 0">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ $t('admin.error_logs.request_body') }}
              </label>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-copy"
                @click="copyJson(selectedLog.body)"
              >
                Copier
              </UButton>
            </div>
            <div
              class="bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto border border-gray-200 dark:border-gray-700"
            >
              <JsonViewer
                :value="selectedLog.body"
                :expand-depth="2"
                boxed
                sort
                :theme="jsonViewerTheme"
              />
            </div>
          </div>

          <!-- Détail technique : code Prisma et message MySQL d'origine, ou décompte des clés
               i18n manquantes. Placé AVANT la trace d'appel, qui est plus longue et moins souvent
               concluante — sur un 500 de base de données, c'est ici que se trouve la réponse. -->
          <div v-if="detailsDuLog">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{
                  detailsDuLog.forme === 'i18n'
                    ? $t('admin.error_logs.i18n_detail')
                    : $t('admin.error_logs.db_detail')
                }}
              </label>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-copy"
                @click="copyJson(selectedLog.prismaDetails)"
              >
                Copier
              </UButton>
            </div>
            <div
              class="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 space-y-3"
            >
              <!-- Les champs qu'on sait nommer, en clair plutôt qu'en JSON à décoder. -->
              <dl
                v-if="detailsDuLog.lignes.length > 0"
                class="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]"
              >
                <template v-for="ligne in detailsDuLog.lignes" :key="ligne.cle">
                  <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {{ ligne.cle }}
                  </dt>
                  <dd class="text-xs font-mono break-all text-gray-900 dark:text-gray-100">
                    {{ ligne.valeur }}
                  </dd>
                </template>
              </dl>

              <!-- Ce qui n'a pas d'étiquette fixe — `meta` de Prisma, dont la forme dépend du code
                   d'erreur, et tout usage futur de la colonne qu'on n'aurait pas prévu. -->
              <div v-if="detailsDuLog.reste" class="overflow-x-auto">
                <JsonViewer
                  :value="detailsDuLog.reste"
                  :expand-depth="2"
                  boxed
                  sort
                  :theme="jsonViewerTheme"
                />
              </div>
            </div>
          </div>

          <!-- Stack trace si disponible -->
          <div v-if="selectedLog.stack">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ $t('admin.error_logs.stack_trace') }}
            </label>
            <UTextarea
              :model-value="selectedLog.stack"
              readonly
              :rows="10"
              variant="outline"
              class="w-full font-mono text-xs"
            />
          </div>

          <!-- Paramètres de requête -->
          <div v-if="selectedLog.queryParams && Object.keys(selectedLog.queryParams).length > 0">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ $t('admin.error_logs.query_params') }}
              </label>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-copy"
                @click="copyJson(selectedLog.queryParams)"
              >
                Copier
              </UButton>
            </div>
            <div
              class="bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto border border-gray-200 dark:border-gray-700"
            >
              <JsonViewer
                :value="selectedLog.queryParams"
                :expand-depth="3"
                boxed
                sort
                :theme="jsonViewerTheme"
              />
            </div>
          </div>

          <!-- Headers HTTP -->
          <div v-if="selectedLog.headers && Object.keys(selectedLog.headers).length > 0">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ $t('admin.error_logs.headers') }}
              </label>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-copy"
                @click="copyJson(selectedLog.headers)"
              >
                Copier
              </UButton>
            </div>
            <div
              class="bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto border border-gray-200 dark:border-gray-700"
            >
              <JsonViewer
                :value="selectedLog.headers"
                :expand-depth="1"
                boxed
                sort
                :theme="jsonViewerTheme"
              />
            </div>
          </div>

          <!-- Section de résolution -->
          <div class="border-t pt-6">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h4 class="text-md font-medium">{{ $t('log.resolution') }}</h4>
              <UBadge
                :color="selectedLog.resolved ? 'success' : 'error'"
                :variant="selectedLog.resolved ? 'subtle' : 'solid'"
              >
                {{ selectedLog.resolved ? 'Résolu' : 'Non résolu' }}
              </UBadge>
            </div>

            <div class="space-y-4">
              <!-- Notes administrateur -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes administrateur
                </label>
                <UTextarea
                  v-model="selectedLog.adminNotes"
                  :placeholder="$t('log.add_admin_notes')"
                  :rows="3"
                  class="w-full"
                />
              </div>

              <!-- Actions -->
              <!-- Le thème applique `truncate` au libellé, donc white-space: nowrap : « Résoudre
                   tous les logs identiques » est insécable, et le bouton prend la largeur de ce
                   texte. flex-wrap lui accorde une ligne à lui seul mais ne le rétrécit pas — il
                   débordait donc du panneau. En pleine largeur sous sm, il ne peut plus dépasser
                   son conteneur, et le libellé tronque si l'écran est vraiment étroit. -->
              <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <UButton
                  v-if="!selectedLog.resolved"
                  color="success"
                  class="w-full justify-center sm:w-auto"
                  :loading="resolving"
                  @click="resolveLog(true)"
                >
                  Marquer comme résolu
                </UButton>
                <UButton
                  v-else
                  color="error"
                  variant="outline"
                  class="w-full justify-center sm:w-auto"
                  :loading="resolving"
                  @click="resolveLog(false)"
                >
                  Marquer comme non résolu
                </UButton>

                <UButton
                  v-if="!selectedLog.resolved"
                  color="warning"
                  variant="outline"
                  icon="i-heroicons-squares-plus"
                  class="w-full justify-center sm:w-auto"
                  :loading="resolvingSimilarLoading"
                  @click="resolveSimilarLogs"
                >
                  {{ $t('admin.error_logs.action_resolve_similar') }}
                </UButton>

                <UButton
                  variant="outline"
                  class="w-full justify-center sm:w-auto"
                  :loading="updatingNotes"
                  @click="updateAdminNotes"
                >
                  {{ $t('admin.error_logs.save_notes') }}
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Confirmation des deux actions irréversibles de l'écran.
         Elles passaient par un `confirm()` natif, qui ne sait afficher qu'une ligne de texte — or
         ce que la résolution en masse devait montrer, c'est justement SUR QUOI elle porte.

         Déclarée APRÈS le panneau latéral, et ce n'est pas cosmétique : ni `UModal` ni
         `USlideover` ne fixent de `z-index`, et tous deux se téléportent dans le `body`.
         L'empilement suit donc l'ordre du DOM, lui-même calqué sur celui du gabarit — placée
         avant, cette modale s'ouvrait SOUS le panneau qui venait de la déclencher. -->
    <UModal v-model:open="confirmationOuverte" :title="confirmation?.titre">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-gray-700 dark:text-gray-300">
            {{ confirmation?.description }}
          </p>

          <!-- Les quatre composantes de l'empreinte, quand l'action en vise une. C'est la portée
               réelle de l'opération, et l'ancienne boîte ne citait que le message. -->
          <dl
            v-if="confirmation?.empreinte"
            class="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr] rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ $t('admin.error_logs.col_type') }}
            </dt>
            <dd class="font-mono text-xs break-all text-gray-900 dark:text-gray-100">
              {{ confirmation.empreinte.errorType ?? '—' }}
            </dd>

            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ $t('admin.error_logs.col_endpoint') }}
            </dt>
            <dd class="font-mono text-xs break-all text-gray-900 dark:text-gray-100">
              {{ confirmation.empreinte.method }} {{ confirmation.empreinte.path }}
            </dd>

            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ $t('admin.error_logs.col_message') }}
            </dt>
            <dd class="font-mono text-xs break-all text-gray-900 dark:text-gray-100">
              {{ confirmation.empreinte.message }}
            </dd>
          </dl>

          <UAlert
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :description="$t('admin.error_logs.irreversible')"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="confirmationOuverte = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="error" @click="confirmerLAction">
            {{ confirmation?.libelleConfirmer }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue'
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/vue3-json-viewer.css'

import { detailsTechniques } from '~/utils/details-techniques-log'

import { composantesDEmpreinte } from '~~/shared/utils/empreinte-erreur'
import { libelleDuType, optionsDuFiltreDeType } from '~~/shared/utils/types-erreur'

// Protection admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()

// Les visionneuses JSON étaient figées sur le thème sombre : en affichage clair, trois grands
// blocs noirs au milieu du panneau. vue3-json-viewer n'accepte que « light » ou « dark ».
const colorMode = useColorMode()
const jsonViewerTheme = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'))
const toast = useToast()
const table = useTemplateRef('table')

// Copier un JSON dans le presse-papier
const copyJson = async (data: unknown) => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    toast.add({ title: $t('admin.error_logs.copied'), color: 'success' })
  } catch {
    toast.add({ title: $t('admin.error_logs.copy_error'), color: 'error' })
  }
}

// État réactif
const loading = ref(false)
const logs = shallowRef<any[]>([])
const stats = shallowRef({
  totalLast24h: 0,
  unresolvedCount: 0,
  errorTypes: [] as any[],
  statusCodes: [] as any[],
})

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
})

const filters = ref({
  search: '',
  status: 'unresolved', // Par défaut, on cache les logs résolus
  errorType: 'all',
  statusCode: 'all',
  path: '',
  ip: '',
  user: '',
  timeRange: '7d', // Par défaut, 7 jours
})

// Valeurs par défaut des filtres (utilisées pour ne pas polluer l'URL)
const FILTER_DEFAULTS = {
  search: '',
  status: 'unresolved',
  errorType: 'all',
  statusCode: 'all',
  path: '',
  ip: '',
  user: '',
  timeRange: '7d',
} as const
const DEFAULT_PAGE_SIZE = 20

// Sur mobile, les filtres vivent dans une fenêtre : huit champs empilés repoussaient le tableau
// hors de l'écran.
const showFilters = ref(false)

/**
 * Nombre de filtres qui s'écartent de leur valeur par défaut.
 *
 * Affiché sur le bouton : sans lui, il faudrait ouvrir la fenêtre pour savoir si la liste est
 * filtrée — et une liste filtrée qu'on croit complète est le meilleur moyen de conclure à tort
 * qu'il n'y a plus d'erreurs.
 */
const activeFilterCount = computed(
  () =>
    (Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]).filter(
      (key) => filters.value[key] && filters.value[key] !== FILTER_DEFAULTS[key]
    ).length
)

const route = useRoute()
const router = useRouter()

// Modal de détails
const showLogDetails = ref(false)
/**
 * Vue GROUPÉE ou à plat.
 *
 * Groupée par défaut : on vient sur cet écran pour savoir quels problèmes existent, pas pour lire
 * une chronologie. La vue à plat reste d'un clic, et c'est elle qu'on veut pour examiner un cas
 * précis ou trier par code.
 */
const vueGroupee = ref(true)
const groupes = ref<any[]>([])
const groupesOntUneSuite = ref(false)

/** L'empreinte du groupe déplié, ou `null`. Un seul à la fois : c'est un coup d'œil, pas une liste. */
const empreinteDepliee = ref<string | null>(null)
const occurrences = ref<any[]>([])
const occurrencesEnCours = ref(false)

/**
 * Le total est-il sûr&nbsp;?
 *
 * Le serveur rendait `1000` quand le comptage échouait, présenté comme un total réel — la
 * pagination proposait alors des pages qui n'existaient pas. Il rend maintenant un minorant et ce
 * drapeau ; l'écran le dit au lieu de faire semblant.
 */
const totalExact = ref(true)

/** La période réellement appliquée, telle que le serveur la renvoie. */
const periodeActive = ref('7d')

const selectedLog = ref<any>(null)

/**
 * Le contenu de `prismaDetails`, démêlé.
 *
 * La colonne porte deux choses sans rapport — le détail d'une erreur de base de données, ou le
 * décompte d'une clé de traduction manquante — et c'est `details-techniques-log.ts` qui tranche,
 * à partir du type d'erreur. `null` quand il n'y a rien à montrer, ce qui est le cas de la plupart
 * des logs : la colonne n'est alimentée que pour ces deux familles.
 */
const detailsDuLog = computed(() =>
  detailsTechniques(selectedLog.value?.errorType, selectedLog.value?.prismaDetails)
)
const resolveResolved = ref(true)

// Options pour les filtres (statiques)
const statusOptions = [
  { label: $t('admin.error_logs.status_unresolved'), value: 'unresolved' },
  { label: $t('admin.error_logs.status_resolved'), value: 'resolved' },
  { label: $t('admin.error_logs.status_all'), value: 'all' },
]

/**
 * Les types d'erreur, dérivés de `~~/shared/utils/types-erreur.ts` au lieu d'être réécrits ici.
 *
 * Cette liste était tenue à la main : huit entrées, quand le serveur en produisait dix-sept. Et le
 * piège n'était pas l'absence des neuf autres, c'est que « Base de données » filtrait sur le repli
 * générique `DatabaseError` — donc EXCLUAIT les interblocages, les dépassements de verrou et les
 * contraintes d'unicité, c'est-à-dire ce qu'on cherchait en ouvrant ce filtre.
 *
 * Les familles sont proposées d'abord, les types précis ensuite.
 */
const errorTypeOptions = optionsDuFiltreDeType()

const statusCodeOptions = [
  { label: $t('admin.error_logs.codes_all'), value: 'all' },
  { label: '400 - Bad Request', value: '400' },
  // Pas de 401 : `server/plugins/error-logging.ts` fait `if (statusCode === 401) return`, donc ce
  // filtre ne pouvait rendre qu'une liste vide — qu'un administrateur lisait comme « aucun problème
  // d'authentification ».
  { label: '403 - Forbidden', value: '403' },
  { label: '404 - Not Found', value: '404' },
  { label: '409 - Conflict', value: '409' },
  { label: '422 - Validation Error', value: '422' },
  { label: '500 - Server Error', value: '500' },
  { label: '502 - Bad Gateway', value: '502' },
  { label: '503 - Service Unavailable', value: '503' },
]

const timeRangeOptions = [
  { label: $t('admin.error_logs.period_1d'), value: '1d' },
  { label: '7 derniers jours', value: '7d' },
  { label: '30 derniers jours', value: '30d' },
  { label: '90 derniers jours', value: '90d' },
  { label: $t('admin.error_logs.period_all'), value: 'all' },
]

const pageSizeOptions = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
]

// Métadonnées de page
useSeoMeta({
  title: "Logs d'erreurs API - Administration",
  description: "Surveillance et résolution des erreurs de l'API",
})

// ===== Tableau (UTable) =====

// Définition des colonnes. Les colonnes optionnelles (user, referer, ip) sont
// masquables via le sélecteur de colonnes ; statut et actions ne le sont pas.
const columns = computed(() => [
  {
    id: 'status',
    accessorKey: 'resolved',
    header: t('admin.error_logs.col_status'),
    enableHiding: false,
  },
  { id: 'createdAt', accessorKey: 'createdAt', header: t('admin.error_logs.col_date') },
  { id: 'statusCode', accessorKey: 'statusCode', header: t('admin.error_logs.col_code') },
  { id: 'errorType', accessorKey: 'errorType', header: t('admin.error_logs.col_type') },
  { id: 'endpoint', accessorKey: 'path', header: t('admin.error_logs.col_endpoint') },
  { id: 'message', accessorKey: 'message', header: t('admin.error_logs.col_message') },
  { id: 'user', accessorKey: 'user.pseudo', header: t('admin.error_logs.col_user') },
  { id: 'referer', accessorKey: 'referer', header: t('admin.error_logs.col_referer') },
  { id: 'ip', accessorKey: 'ip', header: t('admin.error_logs.col_ip') },
  { id: 'actions', accessorKey: 'actions', header: '', enableHiding: false },
])

// Items du menu de visibilité des colonnes (piloté par l'API TanStack du tableau)
const columnVisibilityItems = computed(() => {
  const cols = table.value?.tableApi?.getAllColumns?.() ?? []
  return cols
    .filter((column: any) => column.getCanHide())
    .map((column: any) => ({
      label: typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id,
      type: 'checkbox' as const,
      checked: column.getIsVisible(),
      onUpdateChecked(checked: boolean) {
        column.toggleVisibility(!!checked)
      },
      onSelect(e: Event) {
        e.preventDefault()
      },
    }))
})

// Tri côté serveur (les seuls champs supportés par l'API sont createdAt/statusCode/path)
const sort = ref<{ field: 'createdAt' | 'statusCode' | 'path'; dir: 'asc' | 'desc' }>({
  field: 'createdAt',
  dir: 'desc',
})

const toggleSort = (field: 'createdAt' | 'statusCode' | 'path') => {
  if (sort.value.field === field) {
    sort.value.dir = sort.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value.field = field
    sort.value.dir = 'desc'
  }
  pagination.value.page = 1
  loadLogs()
}

const sortIcon = (field: 'createdAt' | 'statusCode' | 'path') => {
  if (sort.value.field !== field) return 'i-heroicons-arrows-up-down'
  return sort.value.dir === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'
}

// Clic sur une ligne → ouvre le slideover de détails
const onRowSelect = (_e: Event, row: any) => {
  openLogDetails(row.original)
}

// Menu d'actions par ligne
// Menu contextuel (clic droit) : mêmes actions que le menu déroulant de la ligne.
const contextMenuItems = ref<any[]>([])
const onRowContextmenu = (_e: Event, row: { original: any }) => {
  contextMenuItems.value = rowActions(row.original)
}

const rowActions = (log: any) => [
  [
    {
      label: t('admin.error_logs.action_details'),
      icon: 'i-heroicons-eye',
      onSelect: () => openLogDetails(log),
    },
    {
      label: log.resolved
        ? t('admin.error_logs.action_unresolve')
        : t('admin.error_logs.action_resolve'),
      icon: log.resolved ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle',
      onSelect: () => quickResolve(log, !log.resolved),
    },
    {
      label: t('admin.error_logs.action_resolve_similar'),
      icon: 'i-heroicons-check-badge',
      onSelect: () => quickResolveSimilar(log),
    },
  ],
]

/**
 * L'entrée sur laquelle porte l'action en cours.
 *
 * Le tableau et le panneau latéral déclenchent les MÊMES actions sur les mêmes endpoints. Ils
 * avaient pourtant chacun leur code : $fetch avec try/catch à la main d'un côté, `useApiAction` de
 * l'autre — donc deux gestions d'erreur, deux libellés, et deux occasions de diverger. Une seule
 * cible, et les actions ne se demandent plus d'où vient le clic.
 */
const logCible = ref<any>(null)

// Résolution rapide depuis le tableau (sans ouvrir le panneau latéral)
const quickResolve = (log: any, resolved: boolean) => {
  logCible.value = log
  resolveResolved.value = resolved
  executeResolveLog()
}

const quickResolveSimilar = (log: any) => {
  demanderResolutionDesSimilaires(log)
}

// Fonctions utilitaires
const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Date relative (« il y a 5 min ») via Intl, sans dépendance externe
const relativeTimeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const formatRelative = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const seconds = Math.round(diffMs / 1000)
  if (seconds < 60) return relativeTimeFormat.format(-seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relativeTimeFormat.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relativeTimeFormat.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  return relativeTimeFormat.format(-days, 'day')
}

const getStatusCodeColor = (statusCode: number) => {
  if (statusCode >= 500) return 'error'
  if (statusCode >= 400) return 'warning'
  if (statusCode >= 300) return 'warning'
  return 'success'
}

const truncateUrl = (url: string, maxLength: number = 50) => {
  if (url.length <= maxLength) return url
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname
    if (path.length > maxLength - 10) {
      return `${path.substring(0, maxLength - 13)}...`
    }
    return `${urlObj.pathname}${urlObj.search ? '?' : ''}`
  } catch {
    return url.substring(0, maxLength) + '...'
  }
}

// Construit l'objet query d'URL en n'incluant que les valeurs différentes des défauts
const buildUrlQuery = (): Record<string, string> => {
  const q: Record<string, string> = {}
  for (const key of Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]) {
    const value = filters.value[key]
    if (value && value !== FILTER_DEFAULTS[key]) q[key] = String(value)
  }
  if (pagination.value.page && pagination.value.page > 1) q.page = String(pagination.value.page)
  if (pagination.value.pageSize && pagination.value.pageSize !== DEFAULT_PAGE_SIZE)
    q.pageSize = String(pagination.value.pageSize)
  return q
}

// Reflète l'état courant des filtres dans l'URL (replace pour ne pas polluer l'historique)
const syncUrl = () => {
  router.replace({ query: buildUrlQuery() })
}

// Initialise les filtres et la pagination depuis l'URL (au montage / rechargement)
const initFiltersFromUrl = () => {
  const q = route.query
  for (const key of Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]) {
    if (typeof q[key] === 'string') filters.value[key] = q[key] as string
  }
  const page = parseInt(q.page as string)
  if (!isNaN(page) && page > 0) pagination.value.page = page
  const pageSize = parseInt(q.pageSize as string)
  if (!isNaN(pageSize) && pageSize > 0) pagination.value.pageSize = pageSize
}

// Chargement des logs
/**
 * Les paramètres de filtrage, construits une fois pour les deux vues.
 *
 * La liste à plat et la vue groupée doivent porter sur le MÊME ensemble : un compteur de groupe qui
 * ne correspondrait pas aux lignes obtenues en dépliant serait pire qu'une absence de regroupement.
 * Côté serveur, c'est `#server/utils/error-logs/filtres` qui en tire le même `where`.
 */
const parametresDesFiltres = () => {
  const params = new URLSearchParams()
  params.append('page', (pagination.value.page || 1).toString())
  params.append('pageSize', (pagination.value.pageSize || 20).toString())

  if (filters.value.search) params.append('search', filters.value.search)
  if (filters.value.status && filters.value.status !== 'all')
    params.append('status', filters.value.status)
  if (filters.value.timeRange) params.append('timeRange', filters.value.timeRange)
  if (filters.value.errorType && filters.value.errorType !== 'all')
    params.append('errorType', filters.value.errorType)
  if (filters.value.statusCode && filters.value.statusCode !== 'all')
    params.append('statusCode', filters.value.statusCode)
  if (filters.value.path) params.append('path', filters.value.path)
  if (filters.value.ip) params.append('ip', filters.value.ip)
  if (filters.value.user) params.append('user', filters.value.user)

  return params
}

const loadLogs = async () => {
  if (vueGroupee.value) return chargerLesGroupes()

  loading.value = true
  // Garder l'URL synchronisée avec l'état des filtres
  syncUrl()
  try {
    const params = parametresDesFiltres()
    params.append('sortField', sort.value.field)
    params.append('sortDir', sort.value.dir)

    const response = await $fetch(`/api/admin/error-logs?${params}`)

    totalExact.value = response.pagination?.totalExact !== false
    periodeActive.value = response.periode || filters.value.timeRange

    logs.value = response.data || response.logs || []
    stats.value = response.stats || {
      totalLast24h: 0,
      unresolvedCount: 0,
      errorTypes: [],
      statusCodes: [],
    }

    // L'API utilise createPaginatedResponse qui retourne un objet pagination
    if (response.pagination) {
      pagination.value = {
        page: response.pagination.page || 1,
        pageSize: response.pagination.limit || 20,
        total: response.pagination.totalCount || 0,
        totalPages: response.pagination.totalPages || 1,
      }
    }
  } catch (error) {
    console.error('Erreur au chargement du journal :', error)
    toast.add({
      color: 'error',
      title: $t('common.error'),
      description: $t('admin.error_logs.load_error'),
    })
  } finally {
    loading.value = false
  }
}

/** Le libellé de la période active, tiré des options déjà décrites pour le filtre. */
const libellePeriodeActive = computed(
  () =>
    timeRangeOptions.find((option) => option.value === periodeActive.value)?.label ??
    periodeActive.value
)

/** Charge la page de groupes correspondant aux filtres courants. */
const chargerLesGroupes = async () => {
  loading.value = true
  syncUrl()
  try {
    const response: any = await $fetch(`/api/admin/error-logs/groups?${parametresDesFiltres()}`)
    const donnees = response?.data ?? response

    groupes.value = donnees?.groupes ?? []
    groupesOntUneSuite.value = donnees?.pagination?.hasMore === true
    periodeActive.value = donnees?.periode || filters.value.timeRange
    // Les cartes du haut d'écran sont les mêmes dans les deux vues : sans cette ligne, elles
    // seraient restées à zéro à l'ouverture de la page, la vue groupée étant celle par défaut.
    if (donnees?.stats) stats.value = donnees.stats
    // Un groupe déplié n'a plus de sens sur une autre page de résultats.
    empreinteDepliee.value = null
  } catch (error) {
    console.error('Erreur au chargement des groupes :', error)
    toast.add({
      color: 'error',
      title: $t('common.error'),
      description: $t('admin.error_logs.load_groups_error'),
    })
  } finally {
    loading.value = false
  }
}

const changerDeVue = (groupee: boolean) => {
  if (vueGroupee.value === groupee) return
  vueGroupee.value = groupee
  pagination.value.page = 1
  loadLogs()
}

/**
 * Déplie un groupe et charge ses occurrences.
 *
 * Chargées à la demande, et non avec la page : la vue groupée existe précisément pour ne pas
 * rapatrier cinquante lignes identiques qu'on ne lira pas.
 */
const basculerLeGroupe = async (groupe: any) => {
  if (empreinteDepliee.value === groupe.empreinte) {
    empreinteDepliee.value = null
    return
  }

  empreinteDepliee.value = groupe.empreinte
  occurrences.value = []
  occurrencesEnCours.value = true
  try {
    const params = parametresDesFiltres()
    params.set('page', '1')
    // Les quatre composantes passent SÉPARÉMENT : un message peut contenir n'importe quel
    // caractère, y compris celui qui servirait à les recoller.
    params.append('fpErrorType', groupe.errorType ?? '')
    params.append('fpMethod', groupe.method)
    params.append('fpPath', groupe.path)
    params.append('fpMessage', groupe.message)

    const response: any = await $fetch(`/api/admin/error-logs?${params}`)
    occurrences.value = response?.data ?? response?.logs ?? []
  } catch (error) {
    console.error('Erreur au chargement des occurrences :', error)
    occurrences.value = []
  } finally {
    occurrencesEnCours.value = false
  }
}

// Recherche avec debounce
const debouncedSearch = useDebounceFn(() => {
  pagination.value.page = 1
  loadLogs()
}, 500)

// Actions
const refreshLogs = () => {
  loadLogs()
}

const { execute: executeCleanup, loading: cleaningOldLogs } = useApiAction(
  '/api/admin/error-logs/cleanup-old',
  {
    method: 'POST',
    silentSuccess: true,
    errorMessages: { default: 'Impossible de nettoyer les logs' },
    onSuccess: (result: any) => {
      toast.add({
        color: 'success',
        title: $t('admin.error_logs.cleanup_done'),
        description: result.message,
      })
      loadLogs()
    },
  }
)

/**
 * La demande de confirmation en cours, ou `null` quand la modale est fermée.
 *
 * Une seule modale pour les deux actions irréversibles de l'écran. Elles passaient toutes deux par
 * un `confirm()` natif — bloquant, non traduit, supprimable par le navigateur, et incapable de
 * montrer autre chose qu'une ligne de texte. Or c'est justement ce que la résolution en masse
 * devait montrer : SUR QUOI elle porte.
 */
interface DemandeDeConfirmation {
  titre: string
  description: string
  /** Les quatre composantes à afficher, quand l'action porte sur une empreinte. */
  empreinte: ReturnType<typeof composantesDEmpreinte> | null
  libelleConfirmer: string
  agir: () => void
}

const confirmation = ref<DemandeDeConfirmation | null>(null)

const confirmationOuverte = computed({
  get: () => confirmation.value !== null,
  set: (ouverte: boolean) => {
    if (!ouverte) confirmation.value = null
  },
})

/**
 * Demande confirmation avant de résoudre toutes les entrées de la même empreinte.
 *
 * La modale énumère les quatre composantes. L'ancienne boîte native ne citait que le message, et
 * laissait donc croire que la portée s'arrêtait là — alors que l'ancien serveur, lui, résolvait
 * bien sur tous les endpoints.
 */
const demanderResolutionDesSimilaires = (log: any) => {
  logCible.value = log
  confirmation.value = {
    titre: $t('admin.error_logs.resolve_similar_title'),
    description: $t('admin.error_logs.resolve_similar_description'),
    empreinte: composantesDEmpreinte(log ?? {}),
    libelleConfirmer: $t('admin.error_logs.resolve_similar_confirm'),
    agir: executeResolveSimilar,
  }
}

const cleanupOldLogs = () => {
  confirmation.value = {
    titre: $t('admin.error_logs.cleanup_title'),
    description: $t('admin.error_logs.cleanup_description'),
    empreinte: null,
    libelleConfirmer: $t('admin.error_logs.cleanup_confirm'),
    agir: executeCleanup,
  }
}

const confirmerLAction = () => {
  const demande = confirmation.value
  // Fermée AVANT d'agir : l'action recharge la liste, et une modale encore ouverte par-dessus
  // laisserait croire qu'il reste quelque chose à confirmer.
  confirmation.value = null
  demande?.agir()
}

const applyFilters = () => {
  pagination.value.page = 1
  loadLogs()
}

const clearFilters = () => {
  filters.value = { ...FILTER_DEFAULTS }
  pagination.value.page = 1
  loadLogs()
}

const changePage = (page: number) => {
  pagination.value.page = page
  loadLogs()
}

const changePageSize = () => {
  pagination.value.page = 1
  loadLogs()
}

const openLogDetails = async (log: any) => {
  try {
    // Charger les détails complets du log
    const fullLog = await $fetch(`/api/admin/error-logs/${log.id}`)
    selectedLog.value = { ...fullLog, adminNotes: fullLog.adminNotes || '' }
    showLogDetails.value = true
  } catch {
    toast.add({
      color: 'error',
      title: $t('common.error'),
      description: $t('admin.error_logs.load_details_error'),
    })
  }
}

const { execute: executeResolveLog, loading: resolving } = useApiAction(
  () => `/api/admin/error-logs/${logCible.value?.id}/resolve`,
  {
    method: 'PATCH',
    // Aucune mention des notes : basculer un statut n'a rien à en dire. Les envoyer « pour faire
    // bonne mesure » est ce qui les effaçait, le chemin rapide depuis le tableau ne connaissant que
    // la valeur affichée. Les notes ont leur propre action, juste en dessous.
    body: () => ({ resolved: resolveResolved.value }),
    silentSuccess: true,
    errorMessages: { default: $t('admin.error_logs.status_update_error') },
    onSuccess: (result: any) => {
      // Le panneau latéral n'est à jour que s'il montre justement l'entrée qu'on vient de traiter :
      // l'action part aussi bien du tableau, sur une autre ligne.
      if (selectedLog.value && selectedLog.value.id === logCible.value?.id) {
        selectedLog.value.resolved = result.resolved ?? resolveResolved.value
        selectedLog.value.resolvedAt = result.resolvedAt ?? null
      }
      toast.add({ color: 'success', title: $t('common.success'), description: result.message })
      loadLogs()
    },
  }
)

const resolveLog = (resolved: boolean) => {
  if (!selectedLog.value) return
  logCible.value = selectedLog.value
  resolveResolved.value = resolved
  executeResolveLog()
}

const { execute: executeResolveSimilar, loading: resolvingSimilarLoading } = useApiAction(
  '/api/admin/error-logs/resolve-similar',
  {
    method: 'POST',
    // Les QUATRE composantes de l'empreinte, et non le seul message : sans le chemin et la
    // méthode, un « Données invalides » résolu ici l'était sur tous les endpoints à la fois.
    body: () => ({
      ...composantesDEmpreinte(logCible.value ?? {}),
      adminNotes: logCible.value?.adminNotes || undefined,
    }),
    silentSuccess: true,
    errorMessages: { default: $t('admin.error_logs.resolve_similar_error') },
    onSuccess: (result: any) => {
      toast.add({ color: 'success', title: $t('common.success'), description: result.message })
      if (selectedLog.value && selectedLog.value.id === logCible.value?.id) {
        selectedLog.value.resolved = true
        selectedLog.value.resolvedAt = new Date().toISOString()
      }
      loadLogs()
    },
  }
)

const resolveSimilarLogs = () => {
  if (!selectedLog.value) return
  demanderResolutionDesSimilaires(selectedLog.value)
}

const { execute: executeUpdateNotes, loading: updatingNotes } = useApiAction(
  () => `/api/admin/error-logs/${selectedLog.value?.id}/resolve`,
  {
    method: 'PATCH',
    // Ici les notes sont l'objet même de l'appel : une chaîne vide vaut donc effacement voulu.
    body: () => ({
      resolved: selectedLog.value?.resolved,
      adminNotes: selectedLog.value?.adminNotes ?? '',
    }),
    successMessage: {
      title: $t('common.success'),
      description: $t('admin.error_logs.notes_saved'),
    },
    errorMessages: { default: $t('admin.error_logs.notes_save_error') },
  }
)

const updateAdminNotes = () => {
  if (!selectedLog.value) return
  executeUpdateNotes()
}

// Charger les données au montage (en restaurant d'abord les filtres depuis l'URL)
onMounted(() => {
  initFiltersFromUrl()
  loadLogs()
})
</script>
