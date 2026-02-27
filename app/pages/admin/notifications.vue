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
              $t('admin.notification_management')
            }}</span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-bell" class="text-yellow-600" />
        {{ $t('admin.notification_management') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        Envoyer et gérer les notifications système
      </p>
    </div>

    <!-- Actions rapides -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- Envoyer des rappels -->
      <UCard>
        <div class="text-center p-6">
          <div
            class="mx-auto mb-4 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center"
          >
            <UIcon name="i-heroicons-clock" class="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 class="text-lg font-semibold mb-2">{{ $t('admin.event_reminders') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Envoyer des rappels pour les événements à venir
          </p>
          <UButton :loading="sendingReminders" @click="sendReminders">
            Envoyer les rappels
          </UButton>
        </div>
      </UCard>

      <!-- Créer une notification -->
      <UCard>
        <div class="text-center p-6">
          <div
            class="mx-auto mb-4 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
          >
            <UIcon
              name="i-heroicons-paper-airplane"
              class="h-6 w-6 text-green-600 dark:text-green-400"
            />
          </div>
          <h3 class="text-lg font-semibold mb-2">{{ $t('admin.new_notification') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Envoyer une notification personnalisée
          </p>
          <UButton variant="outline" @click="showCreateModal = true">
            Créer une notification
          </UButton>
        </div>
      </UCard>

      <!-- Tester le système -->
      <UCard>
        <div class="text-center p-6">
          <div
            class="mx-auto mb-4 w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center"
          >
            <UIcon name="i-heroicons-beaker" class="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 class="text-lg font-semibold mb-2">{{ $t('admin.test_debug') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Tester les différents types de notifications
          </p>
          <UButton variant="outline" color="primary" @click="showTestModal = true">
            {{ $t('admin.test') }}
          </UButton>
        </div>
      </UCard>

      <!-- Test Firebase -->
      <UCard>
        <div class="text-center p-6">
          <div
            class="mx-auto mb-4 w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center"
          >
            <UIcon name="i-heroicons-fire" class="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 class="text-lg font-semibold mb-2">Test Firebase</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Tester Firebase Cloud Messaging
          </p>
          <UButton variant="outline" color="orange" @click="showFirebaseTestModal = true">
            Tester FCM
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Statistiques -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.total_sent') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats?.totalSent || 0 }}
            </p>
          </div>
          <UIcon name="i-heroicons-paper-airplane" class="h-8 w-8 text-blue-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('notifications.unread') }}
            </p>
            <p class="text-2xl font-bold text-red-600">
              {{ stats?.totalUnread || 0 }}
            </p>
          </div>
          <UIcon name="i-heroicons-bell-alert" class="h-8 w-8 text-red-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('calendar.today') }}
            </p>
            <p class="text-2xl font-bold text-green-600">
              {{ stats?.sentToday || 0 }}
            </p>
          </div>
          <UIcon name="i-heroicons-calendar-days" class="h-8 w-8 text-green-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.active_types') }}
            </p>
            <p class="text-2xl font-bold text-purple-600">
              {{ stats?.activeTypes || 0 }}
            </p>
          </div>
          <UIcon name="i-heroicons-squares-2x2" class="h-8 w-8 text-purple-500" />
        </div>
      </UCard>
    </div>

    <!-- Notifications récentes -->
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold">{{ $t('admin.recent_notifications') }}</h3>
          <UButton
            icon="i-heroicons-arrow-path"
            variant="ghost"
            size="sm"
            :loading="loadingRecent"
            @click="loadRecentNotifications"
          >
            Actualiser
          </UButton>
        </div>
      </template>

      <!-- Filtres améliorés -->
      <div
        class="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
      >
        <!-- En-tête des filtres -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div
              class="flex items-center justify-center w-8 h-8 bg-primary-100 dark:bg-primary-900/20 rounded-lg"
            >
              <UIcon
                name="i-heroicons-funnel"
                class="h-4 w-4 text-primary-600 dark:text-primary-400"
              />
            </div>
            <div>
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Filtres</h4>
              <p class="text-xs text-gray-500 dark:text-gray-400">Affiner les résultats</p>
            </div>
          </div>

          <!-- Compteur de résultats -->
          <div v-if="!loadingRecent" class="text-right">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ pagination.total }} notification{{ pagination.total > 1 ? 's' : '' }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ hasActiveFilters ? 'Filtrées' : 'Total' }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <!-- Filtre par type avec icônes -->
          <div class="space-y-2">
            <label
              class="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              <UIcon name="i-heroicons-tag" class="h-3 w-3 text-gray-500" />
              Type de notification
            </label>
            <USelect
              v-model="filters.type"
              :items="typeFilterItems"
              size="sm"
              color="primary"
              variant="outline"
              placeholder="Sélectionner un type"
              class="w-full"
            />
          </div>

          <!-- Filtre par catégorie avec icônes -->
          <div class="space-y-2">
            <label
              class="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              <UIcon name="i-heroicons-folder" class="h-3 w-3 text-gray-500" />
              Catégorie
            </label>
            <USelect
              v-model="filters.category"
              :items="categoryFilterItems"
              size="sm"
              color="primary"
              variant="outline"
              placeholder="Sélectionner une catégorie"
              class="w-full"
            />
          </div>

          <!-- Filtre par période avec icônes -->
          <div class="space-y-2">
            <label
              class="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              <UIcon name="i-heroicons-calendar-days" class="h-3 w-3 text-gray-500" />
              Période
            </label>
            <USelect
              v-model="filters.days"
              :items="daysFilterItems"
              size="sm"
              color="primary"
              variant="outline"
              class="w-full"
            />
          </div>

          <!-- Actions des filtres -->
          <div class="flex flex-col gap-2">
            <label class="text-xs font-medium text-gray-700 dark:text-gray-300"> Actions </label>
            <div class="flex gap-2">
              <UButton
                icon="i-heroicons-arrow-path"
                size="sm"
                variant="solid"
                color="primary"
                :loading="loadingRecent"
                class="flex-1"
                @click="applyFilters"
              >
                Appliquer
              </UButton>

              <UButton
                icon="i-heroicons-x-mark"
                size="sm"
                variant="outline"
                color="neutral"
                :disabled="!hasActiveFilters"
                @click="resetFilters"
              >
                Reset
              </UButton>
            </div>
          </div>
        </div>

        <!-- Résumé des filtres actifs amélioré -->
        <div
          v-if="hasActiveFilters"
          class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="i-heroicons-check-circle" class="h-4 w-4 text-green-600" />
            <span class="text-xs font-medium text-green-700 dark:text-green-400"
              >Filtres actifs</span
            >
          </div>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-if="filters.type !== 'all'"
              variant="soft"
              color="primary"
              size="sm"
              class="flex items-center gap-1"
            >
              <UIcon name="i-heroicons-tag" class="h-3 w-3" />
              {{ typeFilterItems.find((t) => t.value === filters.type)?.label }}
              <UButton
                icon="i-heroicons-x-mark"
                size="sm"
                variant="ghost"
                color="primary"
                class="ml-1 -mr-1"
                @click="
                  (() => {
                    filters.type = 'all'
                    applyFilters()
                  })()
                "
              />
            </UBadge>

            <UBadge
              v-if="filters.category !== 'all'"
              variant="soft"
              color="success"
              size="sm"
              class="flex items-center gap-1"
            >
              <UIcon name="i-heroicons-folder" class="h-3 w-3" />
              {{ categoryFilterItems.find((c) => c.value === filters.category)?.label }}
              <UButton
                icon="i-heroicons-x-mark"
                size="sm"
                variant="ghost"
                color="success"
                class="ml-1 -mr-1"
                @click="
                  (() => {
                    filters.category = 'all'
                    applyFilters()
                  })()
                "
              />
            </UBadge>

            <UBadge
              v-if="filters.days !== 30"
              variant="soft"
              color="secondary"
              size="sm"
              class="flex items-center gap-1"
            >
              <UIcon name="i-heroicons-calendar-days" class="h-3 w-3" />
              {{ daysFilterItems.find((d) => d.value === filters.days)?.label }}
              <UButton
                icon="i-heroicons-x-mark"
                size="sm"
                variant="ghost"
                color="secondary"
                class="ml-1 -mr-1"
                @click="
                  (() => {
                    filters.days = 30
                    applyFilters()
                  })()
                "
              />
            </UBadge>
          </div>
        </div>
      </div>

      <!-- État vide personnalisé -->
      <div v-if="!loadingRecent && recentNotifications.length === 0" class="text-center py-12">
        <div
          class="mx-auto h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4"
        >
          <UIcon name="i-heroicons-bell-slash" class="h-8 w-8 text-gray-400" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Aucune notification
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          {{
            hasActiveFilters
              ? 'Aucune notification trouvée avec les filtres appliqués.'
              : 'Aucune notification récente à afficher.'
          }}
        </p>
        <UButton v-if="hasActiveFilters" variant="outline" @click="resetFilters">
          <UIcon name="i-heroicons-funnel" class="mr-2" />
          Réinitialiser les filtres
        </UButton>
      </div>

      <!-- Tableau avec syntaxe Nuxt UI v3 correcte -->
      <UTable
        v-else
        :data="recentNotifications"
        :columns="notificationColumns"
        :loading="loadingRecent"
        class="w-full"
      >
        <template #name-cell="{ row }">
          <UiUserDisplayForAdmin :user="row.original.user" />
        </template>
        <template #type-cell="{ row }">
          <div class="flex items-center gap-2">
            <UIcon
              :name="getTypeConfig(row.original.type).icon"
              :class="`h-4 w-4 text-${getTypeConfig(row.original.type).color}-600`"
            />
            <UBadge :color="getTypeConfig(row.original.type).color" variant="soft">
              {{ getTypeConfig(row.original.type).label }}
            </UBadge>
          </div>
        </template>
        <template #title_message-cell="{ row }">
          <div class="min-w-0 max-w-md space-y-2 py-1">
            <p class="font-semibold text-gray-900 dark:text-white leading-tight">
              {{ getNotificationTitle(row.original) }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
              {{ getNotificationMessage(row.original) }}
            </p>
            <div v-if="row.original.actionUrl" class="mt-2 flex items-center gap-2">
              <UButton
                :to="row.original.actionUrl"
                variant="soft"
                color="primary"
                size="xs"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1"
              >
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3 w-3" />
                {{ getNotificationActionText(row.original) }}
              </UButton>
            </div>
          </div>
        </template>
        <template #category-cell="{ row }">
          <div v-if="!row.original.category" class="flex items-center gap-2">
            <UIcon name="i-heroicons-minus" class="h-4 w-4" />
            <span class="text-xs italic">Aucune</span>
          </div>
          <div v-else class="flex items-center gap-2">
            <UIcon
              :name="getCategoryConfig(row.original.category).icon"
              :class="`h-4 w-4 text-${getCategoryConfig(row.original.category).color}-600 dark:text-${getCategoryConfig(row.original.category).color}-400`"
            />
            <UBadge :color="getCategoryConfig(row.original.category).color" variant="soft">
              {{ getCategoryConfig(row.original.category).label }}
            </UBadge>
          </div>
        </template>
        <template #isRead-cell="{ row }">
          <div v-if="row.original.isRead" class="flex items-center gap-2">
            <UIcon name="i-heroicons-check-circle" class="h-4 w-4 text-green-600" />
            <span class="text-sm font-medium text-green-700 dark:text-green-400">Lu</span>
            <span v-if="row.original.readAt" class="text-xs text-gray-500 dark:text-gray-400"
              >le {{ new Date(row.original.readAt).toLocaleDateString() }}</span
            >
          </div>
          <div v-else class="flex items-center gap-2">
            <UIcon name="i-heroicons-x-circle" class="h-4 w-4 text-red-600" />
            <span class="text-sm font-medium text-red-700 dark:text-red-400">Non lu</span>
          </div>
        </template>
        <template #createdAt-cell="{ row }">
          <div class="space-y-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ formatTimeAgoCustom(row.original.createdAt) }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{
                new Date(row.original.createdAt).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }}
            </p>
          </div>
        </template>
        <template #actions-cell="{ row }">
          <UDropdownMenu
            :items="[
              [
                {
                  label: 'Copier ID',
                  icon: 'i-heroicons-clipboard-document',
                  onSelect: () => {
                    navigator?.clipboard.writeText(row.original.id)
                    toast.add({ title: 'ID copié', color: 'success' })
                  },
                },
                {
                  label: row.original.isRead ? 'Marquer non lue' : 'Marquer comme lue',
                  icon: row.original.isRead ? 'i-heroicons-eye-slash' : 'i-heroicons-eye',
                  onSelect: async () => {
                    await toggleNotificationReadStatus(row.original)
                  },
                },
              ],
            ]"
          >
            <UButton
              variant="ghost"
              color="neutral"
              square
              icon="i-heroicons-ellipsis-horizontal"
            />
          </UDropdownMenu>
        </template>
      </UTable>

      <!-- Pagination améliorée -->
      <div
        v-if="pagination.total > pagination.limit"
        class="flex items-center justify-between px-4 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 rounded-b-lg"
      >
        <div class="flex items-center gap-4">
          <!-- Informations de pagination -->
          <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <UIcon name="i-heroicons-bars-3-bottom-left" class="h-4 w-4" />
            <span class="font-medium">
              {{ (pagination.page - 1) * pagination.limit + 1 }}-{{
                Math.min(pagination.page * pagination.limit, pagination.total)
              }}
            </span>
            <span>sur</span>
            <span class="font-semibold text-gray-900 dark:text-white">{{ pagination.total }}</span>
            <span>notification{{ pagination.total > 1 ? 's' : '' }}</span>
          </div>

          <!-- Sélecteur de nombre d'éléments par page -->
          <div class="flex items-center gap-2">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400">Par page :</label>
            <USelect
              v-model="pagination.limit"
              :items="[
                { label: '5', value: 5 },
                { label: '10', value: 10 },
                { label: '20', value: 20 },
                { label: '50', value: 50 },
              ]"
              size="sm"
              class="w-20"
              variant="outline"
            />
          </div>
        </div>

        <!-- Navigation de pagination -->
        <div class="flex items-center gap-3">
          <!-- Boutons de navigation rapide -->
          <UButton
            :disabled="pagination.page === 1"
            variant="ghost"
            size="sm"
            class="hidden sm:flex"
            @click="pagination.page = 1"
          >
            <UIcon name="i-heroicons-chevron-double-left" class="h-4 w-4" />
          </UButton>

          <UPagination
            :model-value="pagination.page"
            :page-count="pagination.limit"
            :total="pagination.total"
            size="sm"
            class="flex-shrink-0"
            @update:model-value="handlePageChange"
          />

          <UButton
            :disabled="pagination.page === pagination.totalPages"
            variant="ghost"
            size="sm"
            class="hidden sm:flex"
            @click="pagination.page = pagination.totalPages"
          >
            <UIcon name="i-heroicons-chevron-double-right" class="h-4 w-4" />
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Modal de création de notification -->
    <UModal
      v-model:open="showCreateModal"
      title="Nouvelle notification"
      description="Créez et envoyez une notification personnalisée"
    >
      <template #body>
        <UForm
          id="create-notification-form"
          :schema="createNotificationSchema"
          :state="createForm"
          class="space-y-5"
          @submit="createNotification"
        >
          <!-- Type et Catégorie -->
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Type de notification" name="type" required>
              <USelect
                v-model="createForm.type"
                :items="notificationTypes"
                placeholder="Choisir le type..."
                icon="i-heroicons-tag"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Catégorie" name="category">
              <USelect
                v-model="createForm.category"
                :items="categoryOptions"
                placeholder="Choisir une catégorie..."
                icon="i-heroicons-folder"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Destinataire -->
          <UFormField
            label="Destinataire (optionnel)"
            name="targetUser"
            description="Laissez vide pour vous l'envoyer (test)"
          >
            <UserSelector
              v-model="createForm.targetUser"
              v-model:search-term="createSearchQuery"
              :searched-users="createSearchedUsers"
              :searching-users="createSearchingUsers"
              placeholder="Rechercher un utilisateur..."
              :show-clear-button="true"
            />
          </UFormField>

          <!-- Contenu -->
          <UFormField label="Titre" name="title" required>
            <UInput
              v-model="createForm.title"
              placeholder="Ex: Nouvelle convention disponible"
              icon="i-heroicons-megaphone"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Message" name="message" required>
            <UTextarea
              v-model="createForm.message"
              placeholder="Décrivez le contenu de votre notification..."
              :rows="4"
              class="w-full"
            />
          </UFormField>

          <!-- Action optionnelle -->
          <div class="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p class="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <UIcon name="i-heroicons-cursor-arrow-rays" class="h-3 w-3" />
              Action optionnelle
            </p>

            <div class="grid grid-cols-2 gap-3">
              <UFormField label="URL de redirection" name="actionUrl">
                <UInput
                  v-model="createForm.actionUrl"
                  placeholder="https://..."
                  icon="i-heroicons-link"
                />
              </UFormField>

              <UFormField label="Texte du bouton" name="actionText">
                <UInput
                  v-model="createForm.actionText"
                  placeholder="Ex: Voir détails"
                  icon="i-heroicons-arrow-right"
                />
              </UFormField>
            </div>
          </div>

          <!-- Preview de la notification -->
          <div
            v-if="createForm.title || createForm.message"
            class="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <p class="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">Aperçu :</p>
            <div class="space-y-1">
              <p v-if="createForm.title" class="font-medium text-sm text-gray-900 dark:text-white">
                {{ createForm.title }}
              </p>
              <p v-if="createForm.message" class="text-xs text-gray-600 dark:text-gray-400">
                {{ createForm.message.substring(0, 100)
                }}{{ createForm.message.length > 100 ? '...' : '' }}
              </p>
            </div>
          </div>
        </UForm>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            variant="ghost"
            :disabled="creatingNotification"
            @click="showCreateModal = false"
          >
            Annuler
          </UButton>
          <UButton
            type="submit"
            form="create-notification-form"
            :loading="creatingNotification"
            color="primary"
            :disabled="!createForm.type || !createForm.title || !createForm.message"
          >
            <UIcon name="i-heroicons-paper-airplane" class="mr-2" />
            {{ creatingNotification ? 'Envoi...' : 'Créer et envoyer' }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal de test -->
    <UModal
      v-model:open="showTestModal"
      title="Test de notification"
      description="Envoyez une notification de test personnalisée"
    >
      <template #body>
        <UForm
          id="test-notification-form"
          :schema="testNotificationSchema"
          :state="testForm"
          class="space-y-6"
          @submit="testNotificationAdvanced"
        >
          <!-- Recherche et sélection d'utilisateur -->
          <UFormField
            label="Destinataire"
            name="targetUser"
            description="Recherchez et sélectionnez l'utilisateur qui recevra la notification"
            required
          >
            <UserSelector
              v-model="testForm.targetUser"
              v-model:search-term="searchQuery"
              :searched-users="searchedUsers"
              :searching-users="searchingUsers"
              placeholder="Rechercher un utilisateur..."
              :test-users="testUserItems"
            />
          </UFormField>

          <!-- Type de notification -->
          <UFormField label="Type de notification" name="type" required>
            <USelect
              v-model="testForm.type"
              :items="testTypesWithLabels"
              placeholder="Sélectionnez le type de notification..."
              class="w-full"
              icon="i-heroicons-tag"
            />
          </UFormField>

          <!-- Message personnalisé (conditionnel) -->
          <UFormField
            v-if="testForm.type === 'custom'"
            label="Message personnalisé"
            name="message"
            description="Rédigez votre message de test personnalisé"
            class="w-full"
          >
            <UTextarea
              v-model="testForm.message"
              placeholder="Votre message de test personnalisé..."
              :rows="4"
              class="w-full"
            />
          </UFormField>
        </UForm>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" :disabled="testingAdvanced" @click="showTestModal = false">
            Annuler
          </UButton>
          <UButton
            type="submit"
            form="test-notification-form"
            :loading="testingAdvanced"
            color="primary"
            :disabled="!testForm.targetUser || !testForm.type"
          >
            <UIcon name="i-heroicons-paper-airplane" class="mr-2" />
            {{ testingAdvanced ? 'Envoi en cours...' : 'Envoyer le test' }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal de test Firebase -->
    <UModal
      v-model:open="showFirebaseTestModal"
      title="Test Firebase Cloud Messaging"
      description="Testez l'envoi de notifications via Firebase"
    >
      <template #body>
        <div class="space-y-6">
          <!-- Statut Firebase -->
          <div
            class="p-4 rounded-lg border"
            :class="
              isAvailable
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            "
          >
            <div class="flex items-center gap-2">
              <UIcon
                :name="isAvailable ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
                class="h-5 w-5"
                :class="isAvailable ? 'text-green-600' : 'text-red-600'"
              />
              <span
                class="font-medium"
                :class="
                  isAvailable
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-red-900 dark:text-red-100'
                "
              >
                Firebase Cloud Messaging {{ isAvailable ? 'disponible' : 'non disponible' }}
              </span>
            </div>
          </div>

          <!-- Étape 1: Obtenir le token -->
          <div class="space-y-3">
            <h4 class="font-medium text-sm text-gray-900 dark:text-white">
              1. Obtenir le token FCM
            </h4>
            <UButton
              variant="outline"
              color="orange"
              icon="i-heroicons-key"
              :disabled="!isAvailable"
              @click="getFirebaseToken"
            >
              {{ firebaseToken ? 'Renouveler le token' : 'Obtenir le token' }}
            </UButton>
            <div v-if="firebaseToken" class="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">Token FCM:</p>
              <p class="text-xs font-mono break-all text-gray-900 dark:text-gray-100">
                {{ firebaseToken.substring(0, 50) }}...
              </p>
            </div>
          </div>

          <!-- Étape 2: Configuration de la notification -->
          <div class="space-y-3">
            <h4 class="font-medium text-sm text-gray-900 dark:text-white">
              2. Configuration de la notification
            </h4>

            <UFormField label="Titre" required>
              <UInput v-model="firebaseTestForm.title" placeholder="Titre de la notification..." />
            </UFormField>

            <UFormField label="Message" required>
              <UTextarea
                v-model="firebaseTestForm.body"
                placeholder="Message de la notification..."
                :rows="3"
              />
            </UFormField>

            <UFormField label="URL d'action" description="URL de redirection lors du clic">
              <UInput v-model="firebaseTestForm.actionUrl" placeholder="/notifications" />
            </UFormField>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            variant="ghost"
            :disabled="testingFirebase"
            @click="showFirebaseTestModal = false"
          >
            Annuler
          </UButton>
          <UButton
            color="orange"
            :loading="testingFirebase"
            :disabled="!firebaseToken || !firebaseTestForm.title || !firebaseTestForm.body"
            @click="testFirebaseNotification"
          >
            <UIcon name="i-heroicons-fire" class="mr-2" />
            {{ testingFirebase ? 'Envoi en cours...' : 'Envoyer via Firebase' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { formatTimeAgoIntl } from '@vueuse/core'
import { z } from 'zod'

const { requestPermissionAndGetToken, isAvailable } = useFirebaseMessaging()

// Protection admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

useSeoMeta({
  title: 'Gestion des Notifications - Administration',
  description: 'Envoyer et gérer les notifications système',
})

const toast = useToast()

// État réactif
const showCreateModal = ref(false)
const showTestModal = ref(false)
const showFirebaseTestModal = ref(false)

interface NotificationStats {
  totalSent: number
  totalUnread: number
  sentToday: number
  activeTypes: number
}

interface RecentNotification {
  id: string
  type: string
  category: string | null
  // Ancien système (rétrocompatibilité)
  title?: string
  message?: string
  // Système de traduction (notifications système)
  titleKey?: string
  messageKey?: string
  translationParams?: Record<string, any>
  actionTextKey?: string
  // Texte libre (notifications custom/orgas)
  titleText?: string
  messageText?: string
  actionText?: string
  isRead: boolean
  readAt: string | null
  createdAt: string
  actionUrl: string | null
  user: {
    id: number
    email: string
    emailHash: string
    pseudo: string
    nom: string | null
    prenom: string | null
    profilePicture: string | null
  }
}

interface NotificationPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const stats = ref<NotificationStats | null>(null)
const recentNotifications = ref<RecentNotification[]>([])
const pagination = ref<NotificationPagination>({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
})

// Filtres pour les notifications
const filters = ref({
  category: 'all',
  type: 'all',
  days: 30,
})

// Formulaire de création
const createNotificationSchema = z.object({
  targetUser: z
    .object({
      id: z.number(),
      label: z.string(),
      email: z.string().optional(),
      isRealUser: z.boolean().optional(),
    })
    .optional()
    .nullable(),
  type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  category: z.string().optional(),
  actionUrl: z.string().url().optional().or(z.literal('')),
  actionText: z.string().max(50).optional(),
})

const createForm = reactive({
  targetUser: null as UserSelectItem | null,
  type: 'INFO' as 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR',
  title: '',
  message: '',
  category: 'none',
  actionUrl: '',
  actionText: '',
})

// Formulaire de test avancé
const testNotificationSchema = z.object({
  targetUser: z.object({
    id: z.number(),
    label: z.string(),
    email: z.string().optional(), // Email optionnel pour les vrais utilisateurs
    isRealUser: z.boolean().optional(),
  }),
  type: z.enum([
    'welcome',
    'volunteer-accepted',
    'volunteer-rejected',
    'event-reminder',
    'system-error',
    'custom',
  ]),
  message: z.string().optional(),
})

interface UserSelectItem {
  id: number
  label: string
  email: string
  avatar?: { src: string; alt: string }
  isRealUser?: boolean // true pour les vrais utilisateurs, false/undefined pour les utilisateurs de test
}

// Fonctions utilitaires pour afficher les notifications (gère i18n et texte libre)
const { t } = useI18n()

const getNotificationTitle = (notification: RecentNotification) => {
  // Système de traduction - utiliser la clé
  if ('titleKey' in notification && notification.titleKey) {
    return t(notification.titleKey, notification.translationParams || {})
  }
  // Texte libre - afficher directement
  return notification.titleText || notification.title || ''
}

const getNotificationMessage = (notification: RecentNotification) => {
  // Système de traduction - utiliser la clé
  if ('messageKey' in notification && notification.messageKey) {
    return t(notification.messageKey, notification.translationParams || {})
  }
  // Texte libre - afficher directement
  return notification.messageText || notification.message || ''
}

const getNotificationActionText = (notification: RecentNotification) => {
  // Système de traduction - utiliser la clé
  if ('actionTextKey' in notification && notification.actionTextKey) {
    return t(notification.actionTextKey, notification.translationParams || {})
  }
  // Texte libre - afficher directement
  return notification.actionText || 'Voir détails'
}

const testForm = reactive({
  targetUser: null as UserSelectItem | null,
  type: 'welcome' as
    | 'welcome'
    | 'volunteer-accepted'
    | 'volunteer-rejected'
    | 'event-reminder'
    | 'system-error'
    | 'custom',
  message: '',
})

// Firebase test
const firebaseToken = ref<string | null>(null)
const firebaseTestForm = reactive({
  title: 'Test Firebase',
  body: 'Ceci est une notification de test via Firebase Cloud Messaging',
  actionUrl: '/notifications',
})

// Options
const notificationTypes = [
  { label: 'Information', value: 'INFO' },
  { label: 'Succès', value: 'SUCCESS' },
  { label: 'Avertissement', value: 'WARNING' },
  { label: 'Erreur', value: 'ERROR' },
]

const categoryOptions = [
  { label: 'Aucune catégorie', value: 'none' },
  { label: 'Système', value: 'system' },
  { label: 'Édition', value: 'edition' },
  { label: 'Bénévolat', value: 'volunteer' },
  { label: 'Autre', value: 'other' },
]

// Variables pour la recherche d'utilisateurs (modal de test)
const searchedUsers = ref<UserSelectItem[]>([])
const searchingUsers = ref(false)
const searchQuery = ref('')
let searchTimeout: NodeJS.Timeout

// Variables pour la recherche d'utilisateurs (modal de création)
const createSearchedUsers = ref<UserSelectItem[]>([])
const createSearchingUsers = ref(false)
const createSearchQuery = ref('')
let createSearchTimeout: NodeJS.Timeout

// Utilisateurs de test disponibles (format compatible avec le nouveau système)
const testUserItems: UserSelectItem[] = [
  { id: -1, label: 'Alice Jongleuse (utilisateur test)', email: 'alice.jongleuse@example.com' },
  { id: -2, label: 'Bob Cirque (utilisateur test)', email: 'bob.cirque@example.com' },
  { id: -3, label: 'Charlie Diabolo (utilisateur test)', email: 'charlie.diabolo@example.com' },
  { id: -4, label: 'Diana Massues (utilisateur test)', email: 'diana.massues@example.com' },
  { id: -5, label: 'Marie Bénévole (bénévole)', email: 'marie.benevole@example.com' },
  { id: -6, label: 'Paul Aidant (bénévole)', email: 'paul.aidant@example.com' },
  { id: -7, label: 'Powange User (utilisateur)', email: 'powange@hotmail.com' },
]

// Options pour les filtres (format Nuxt UI v3 avec icônes)
const typeFilterItems = [
  { label: 'Tous les types', value: 'all', icon: 'i-heroicons-squares-2x2' },
  { label: 'Information', value: 'INFO', icon: 'i-heroicons-information-circle' },
  { label: 'Succès', value: 'SUCCESS', icon: 'i-heroicons-check-circle' },
  { label: 'Avertissement', value: 'WARNING', icon: 'i-heroicons-exclamation-triangle' },
  { label: 'Erreur', value: 'ERROR', icon: 'i-heroicons-x-circle' },
]

const categoryFilterItems = [
  { label: 'Toutes les catégories', value: 'all', icon: 'i-heroicons-squares-2x2' },
  { label: 'Système', value: 'system', icon: 'i-heroicons-cog-6-tooth' },
  { label: 'Édition', value: 'edition', icon: 'i-heroicons-calendar-days' },
  { label: 'Bénévolat', value: 'volunteer', icon: 'i-heroicons-heart' },
  { label: 'Autre', value: 'other', icon: 'i-heroicons-ellipsis-horizontal-circle' },
]

const daysFilterItems = [
  { label: 'Derniers 7 jours', value: 7 },
  { label: 'Derniers 30 jours', value: 30 },
  { label: 'Derniers 90 jours', value: 90 },
  { label: 'Toutes', value: 365 },
]

// Options avec labels pour USelect (format correct avec value)
const testTypesWithLabels = ref([
  {
    label: 'Bienvenue',
    value: 'welcome',
  },
  {
    label: 'Bénévole accepté',
    value: 'volunteer-accepted',
  },
  {
    label: 'Bénévole refusé',
    value: 'volunteer-rejected',
  },
  {
    label: "Rappel d'événement",
    value: 'event-reminder',
  },
  {
    label: 'Erreur système',
    value: 'system-error',
  },
  {
    label: 'Personnalisée',
    value: 'custom',
  },
])

const getCategoryConfig = (cat: string): { color: any; icon: string; label: string } => {
  switch (cat) {
    case 'system':
      return { color: 'neutral', icon: 'i-heroicons-cog-6-tooth', label: 'Système' }
    case 'edition':
      return { color: 'info', icon: 'i-heroicons-calendar-days', label: 'Édition' }
    case 'volunteer':
      return { color: 'success', icon: 'i-heroicons-heart', label: 'Bénévolat' }
    case 'other':
      return {
        color: 'purple',
        icon: 'i-heroicons-ellipsis-horizontal-circle',
        label: 'Autre',
      }
    default:
      return { color: 'neutral', icon: 'i-heroicons-folder', label: cat }
  }
}

const getTypeConfig = (type: string): { color: any; icon: string; label: string } => {
  switch (type) {
    case 'ERROR':
      return { color: 'error', icon: 'i-heroicons-x-circle', label: 'Erreur' }
    case 'SUCCESS':
      return { color: 'success', icon: 'i-heroicons-check-circle', label: 'Succès' }
    case 'WARNING':
      return {
        color: 'warning',
        icon: 'i-heroicons-exclamation-triangle',
        label: 'Attention',
      }
    default:
      return { color: 'info', icon: 'i-heroicons-information-circle', label: 'Info' }
  }
}

// Type pour les lignes du tableau (utilisé pour les colonnes)
// type NotificationRow = RecentNotification

// Colonnes du tableau des notifications
const notificationColumns = [
  {
    accessorKey: 'user.pseudo',
    header: 'Utilisateur',
    id: 'name',
  },
  {
    accessorKey: 'type',
    header: 'Type',
    id: 'type',
  },
  {
    accessorKey: 'title',
    header: 'Titre & Message',
    id: 'title_message',
  },
  {
    accessorKey: 'category',
    header: 'Catégorie',
    id: 'category',
  },
  {
    accessorKey: 'isRead',
    header: 'Statut',
    id: 'isRead',
  },
  {
    accessorKey: 'createdAt',
    header: 'Date',
    id: 'createdAt',
  },
  {
    accessorKey: 'actions',
    header: '',
    id: 'actions',
  },
]

// Méthodes utilitaires

// Fonction pour formater les dates en mode humain avec Intl
const formatTimeAgoCustom = (dateString: string) => {
  const { locale } = useI18n()
  return formatTimeAgoIntl(new Date(dateString), {
    locale: locale.value, // Utilise la locale actuelle de l'application
    relativeTimeFormatOptions: {
      numeric: 'auto', // Affiche "hier" au lieu de "il y a 1 jour"
      style: 'long', // Style long pour plus de précision
    },
  })
}

const handlePageChange = (newPage: number) => {
  console.log('handlePageChange called with page:', newPage)
  pagination.value.page = newPage
  // Force le rechargement immédiatement
  loadRecentNotifications()
}

// Actions
const { execute: executeSendReminders, loading: sendingReminders } = useApiAction(
  '/api/admin/notifications/send-reminders',
  {
    method: 'POST',
    silentSuccess: true,
    errorMessages: { default: "Impossible d'envoyer les rappels" },
    onSuccess: async (result: any) => {
      toast.add({ color: 'success', title: 'Rappels envoyés', description: result.message })
      await executeLoadStats()
      await loadRecentNotifications()
    },
  }
)

const sendReminders = () => executeSendReminders()

const { execute: executeCreateNotification, loading: creatingNotification } = useApiAction(
  '/api/admin/notifications/create',
  {
    method: 'POST',
    body: () => ({
      userId: createForm.targetUser?.id,
      type: createForm.type,
      title: createForm.title,
      message: createForm.message,
      category: createForm.category === 'none' ? undefined : createForm.category || undefined,
      actionUrl: createForm.actionUrl || undefined,
      actionText: createForm.actionText || undefined,
    }),
    silentSuccess: true,
    errorMessages: { default: "Impossible d'envoyer la notification" },
    onSuccess: async (result: any) => {
      toast.add({ color: 'success', title: 'Notification envoyée', description: result.message })
      showCreateModal.value = false
      resetCreateForm()
      await executeLoadStats()
      await loadRecentNotifications()
    },
  }
)

const createNotification = () => executeCreateNotification()

// Fonction pour rechercher des utilisateurs
const searchUsers = async (query: string) => {
  if (!query || query.length < 2) {
    searchedUsers.value = []
    return
  }

  try {
    searchingUsers.value = true
    const response = await $fetch<any>('/api/admin/users', {
      query: {
        search: query,
        limit: 10, // Limiter à 10 résultats pour la recherche
      },
    })

    searchedUsers.value = response.data.map((u: any) => ({
      id: u.id,
      label: `${u.pseudo} (${u.email})`,
      pseudo: u.pseudo,
      email: u.email,
      emailHash: '', // Non nécessaire pour l'affichage mais requis par l'interface
      profilePicture: u.profilePicture,
      isRealUser: true,
    }))
  } catch (error) {
    console.error('Erreur lors de la recherche:', error)
    searchedUsers.value = []
  } finally {
    searchingUsers.value = false
  }
}

// Fonction pour rechercher des utilisateurs (modal de création)
const searchUsersForCreate = async (query: string) => {
  if (!query || query.length < 2) {
    createSearchedUsers.value = []
    return
  }

  try {
    createSearchingUsers.value = true
    const response = await $fetch<any>('/api/admin/users', {
      query: {
        search: query,
        limit: 10,
      },
    })

    createSearchedUsers.value = response.data.map((u: any) => ({
      id: u.id,
      label: `${u.pseudo} (${u.email})`,
      pseudo: u.pseudo,
      email: u.email,
      emailHash: '', // Non nécessaire pour l'affichage mais requis par l'interface
      profilePicture: u.profilePicture,
      isRealUser: true,
    }))
  } catch (error) {
    console.error('Erreur lors de la recherche:', error)
    createSearchedUsers.value = []
  } finally {
    createSearchingUsers.value = false
  }
}

// Watcher sur searchQuery pour déclencher la recherche (modal de test)
watch(searchQuery, (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => searchUsers(query), 300)
})

// Watcher sur createSearchQuery pour déclencher la recherche (modal de création)
watch(createSearchQuery, (query) => {
  if (createSearchTimeout) clearTimeout(createSearchTimeout)
  createSearchTimeout = setTimeout(() => searchUsersForCreate(query), 300)
})

// Test avancé avec utilisateur sélectionné et message personnalisé
const { execute: executeTestAdvanced, loading: testingAdvanced } = useApiAction(
  '/api/admin/notifications/test',
  {
    method: 'POST',
    body: () => {
      const requestBody: any = {
        type: testForm.type,
        message: testForm.message || undefined,
      }
      if (testForm.targetUser?.isRealUser) {
        requestBody.targetUserId = testForm.targetUser.id
      } else if (testForm.targetUser) {
        requestBody.targetUserEmail = testForm.targetUser.email
      }
      return requestBody
    },
    silentSuccess: true,
    errorMessages: { default: "Impossible d'envoyer le test" },
    onSuccess: async () => {
      toast.add({
        color: 'success',
        title: 'Test personnalisé envoyé',
        description: `Notification ${testForm.type} envoyée à ${testForm.targetUser?.label}`,
      })
      showTestModal.value = false
      resetTestForm()
      await executeLoadStats()
      await loadRecentNotifications()
    },
  }
)

const testNotificationAdvanced = () => {
  if (!testForm.targetUser) {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Veuillez sélectionner un utilisateur destinataire',
    })
    return
  }
  executeTestAdvanced()
}

const resetCreateForm = () => {
  Object.assign(createForm, {
    targetUser: null,
    type: 'INFO' as const,
    title: '',
    message: '',
    category: 'none',
    actionUrl: '',
    actionText: '',
  })
  // Reset des variables de recherche
  createSearchedUsers.value = []
  createSearchQuery.value = ''
}

const resetTestForm = () => {
  Object.assign(testForm, {
    targetUser: null, // Pas de sélection par défaut
    type: 'welcome' as const,
    message: '',
  })
  // Reset des variables de recherche
  searchedUsers.value = []
  searchQuery.value = ''
}

// Fonctions Firebase
const getFirebaseToken = async () => {
  try {
    const token = await requestPermissionAndGetToken()
    if (token) {
      firebaseToken.value = token
      toast.add({
        color: 'success',
        title: 'Token FCM obtenu',
        description: 'Le token Firebase a été récupéré avec succès',
      })
    } else {
      toast.add({
        color: 'error',
        title: 'Erreur',
        description: "Impossible d'obtenir le token FCM. Vérifiez les permissions.",
      })
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du token FCM:', error)
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Une erreur est survenue lors de la récupération du token',
    })
  }
}

const { execute: executeTestFirebase, loading: testingFirebase } = useApiAction(
  '/api/admin/notifications/test-firebase',
  {
    method: 'POST',
    body: () => ({
      token: firebaseToken.value,
      title: firebaseTestForm.title,
      body: firebaseTestForm.body,
      actionUrl: firebaseTestForm.actionUrl,
    }),
    successMessage: {
      title: 'Notification Firebase envoyée',
      description: 'La notification de test a été envoyée via Firebase Cloud Messaging',
    },
    errorMessages: { default: "Impossible d'envoyer la notification Firebase" },
    onSuccess: () => {
      showFirebaseTestModal.value = false
    },
  }
)

const testFirebaseNotification = () => {
  if (!firebaseToken.value) {
    toast.add({
      color: 'error',
      title: 'Token manquant',
      description: "Veuillez d'abord obtenir un token FCM",
    })
    return
  }
  executeTestFirebase()
}

// Fonction pour basculer le statut de lecture d'une notification
const notificationToToggle = ref<RecentNotification | null>(null)

const { execute: executeToggleRead, loading: togglingRead } = useApiAction(
  () =>
    notificationToToggle.value?.isRead
      ? `/api/notifications/${notificationToToggle.value.id}/unread`
      : `/api/notifications/${notificationToToggle.value?.id}/read`,
  {
    method: 'PATCH',
    silentSuccess: true,
    errorMessages: { default: 'Impossible de modifier le statut de lecture' },
    onSuccess: async () => {
      if (notificationToToggle.value) {
        const wasRead = notificationToToggle.value.isRead
        notificationToToggle.value.isRead = !wasRead
        notificationToToggle.value.readAt = !wasRead ? new Date().toISOString() : null
        toast.add({
          color: 'success',
          title: !wasRead ? 'Marquée comme lue' : 'Marquée comme non lue',
        })
      }
      await executeLoadStats()
    },
  }
)

const toggleNotificationReadStatus = (notification: RecentNotification) => {
  if (togglingRead.value) return
  notificationToToggle.value = notification
  executeToggleRead()
}

const { execute: executeLoadStats } = useApiAction('/api/admin/notifications/stats', {
  method: 'GET',
  errorMessages: { default: 'Impossible de charger les statistiques' },
  onSuccess: (response: any) => {
    stats.value = {
      totalSent: response.totalSent || 0,
      totalUnread: response.unreadCount || 0,
      sentToday: response.thisWeekCount || 0,
      activeTypes: response.pushSubscriptionsActive || 0,
    }
  },
})

const { execute: loadRecentNotifications, loading: loadingRecent } = useApiAction(
  '/api/admin/notifications/recent',
  {
    method: 'GET',
    query: () => {
      const q: Record<string, unknown> = {
        page: pagination.value.page,
        limit: pagination.value.limit,
        days: filters.value.days,
      }
      if (filters.value.type !== 'all') q.type = filters.value.type
      if (filters.value.category !== 'all') q.category = filters.value.category
      return q
    },
    errorMessages: { default: 'Impossible de charger les notifications récentes' },
    onSuccess: (response: any) => {
      recentNotifications.value = response.data || []
      if (response.pagination) {
        pagination.value = {
          ...pagination.value,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages,
        }
      }
    },
    onError: () => {
      recentNotifications.value = []
      pagination.value.total = 0
      pagination.value.totalPages = 0
    },
  }
)

// Computed pour les filtres
const hasActiveFilters = computed(() => {
  return (
    filters.value.type !== 'all' || filters.value.category !== 'all' || filters.value.days !== 30
  )
})

// Méthodes pour les filtres
const applyFilters = () => {
  // Réinitialiser à la page 1 et recharger
  pagination.value.page = 1
  loadRecentNotifications()
}

const resetFilters = () => {
  filters.value = {
    category: 'all',
    type: 'all',
    days: 30,
  }
  pagination.value.page = 1
  loadRecentNotifications()
}

// Watchers pour la pagination - Désactivé car on utilise handlePageChange
// watch(
//   () => pagination.value.page,
//   (newPage, oldPage) => {
//     console.log('Page changed from', oldPage, 'to', newPage)
//     // Recharger les données quand on change de page
//     if (newPage !== undefined && newPage !== oldPage) {
//       loadRecentNotifications()
//     }
//   }
// )

watch(
  () => pagination.value.limit,
  (newLimit, oldLimit) => {
    console.log('Limit changed from', oldLimit, 'to', newLimit)
    // Réinitialiser à la page 1 et recharger quand on change la limite
    if (newLimit !== oldLimit) {
      pagination.value.page = 1
      loadRecentNotifications()
    }
  }
)

// Watcher pour appliquer automatiquement les filtres
watch(
  () => filters.value.days,
  () => {
    // Recharger automatiquement quand on change la période
    pagination.value.page = 1
    loadRecentNotifications()
  }
)

// Initialisation
onMounted(async () => {
  await Promise.all([executeLoadStats(), loadRecentNotifications()])
})
</script>
