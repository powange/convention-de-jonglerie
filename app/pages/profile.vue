<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- En-tête profil moderne -->
    <div
      class="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-2xl p-6 sm:p-8 mb-8"
    >
      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div class="relative group">
          <UiUserAvatar
            v-if="authStore.user"
            :user="authStore.user"
            :size="120"
            border
            class="shadow-xl transition-transform group-hover:scale-105"
          />
          <UButton
            icon="i-heroicons-camera"
            size="sm"
            color="primary"
            variant="solid"
            class="absolute -bottom-2 -right-2 rounded-full shadow-lg transition-all hover:scale-110"
            @click="openProfilePictureModal"
          />
        </div>
        <div class="text-center sm:text-left flex-1">
          <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {{ $t('profile.hello', { name: authStore.user?.prenom || authStore.user?.pseudo }) }}
          </h1>
          <div class="space-y-2">
            <div
              class="flex items-center justify-center sm:justify-start gap-2 text-gray-600 dark:text-gray-300"
            >
              <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
              <span class="text-sm">
                {{ $t('profile.member_since', { date: formatMemberSince }) }}
              </span>
            </div>
            <div
              class="flex items-center justify-center sm:justify-start gap-2 text-gray-500 dark:text-gray-400"
            >
              <UIcon name="i-heroicons-photo" class="w-4 h-4" />
              <span class="text-xs">
                {{
                  authStore.user?.profilePicture
                    ? t('profile.custom_profile_picture')
                    : t('profile.gravatar_avatar')
                }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Colonne de gauche -->
      <div class="lg:col-span-2 space-y-8">
        <!-- Informations utilisateur -->
        <UCard class="shadow-lg border-0">
          <template #header>
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center"
              >
                <UIcon
                  name="i-heroicons-user"
                  class="w-5 h-5 text-primary-600 dark:text-primary-400"
                />
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                  {{ $t('profile.personal_info') }}
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('profile.manage_profile_info') }}
                </p>
              </div>
            </div>
          </template>

          <UForm :state="state" :schema="schema" class="space-y-10" @submit="updateProfile">
            <div class="space-y-6">
              <UFormField
                :label="t('auth.username')"
                name="pseudo"
                :help="t('profile.username_help')"
              >
                <UInput
                  v-model="state.pseudo"
                  icon="i-heroicons-at-symbol"
                  required
                  :placeholder="t('profile.username_placeholder')"
                  size="lg"
                  class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                />
              </UFormField>

              <UFormField :label="t('common.email')" name="email">
                <UInput
                  v-model="state.email"
                  type="email"
                  icon="i-heroicons-envelope"
                  required
                  placeholder="votre.email@example.com"
                  size="lg"
                  class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                />
              </UFormField>
            </div>

            <!-- Section champs facultatifs -->
            <div
              class="border border-gray-100 dark:border-gray-700 rounded-xl p-5 space-y-6 bg-gray-50/50 dark:bg-gray-800/30"
            >
              <div class="flex items-center gap-2 mb-2">
                <UIcon name="i-heroicons-adjustments-horizontal" class="w-5 h-5 text-gray-500" />
                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('profile.optional_section_title') }}
                </h3>
                <UBadge variant="soft" color="neutral" size="xs">{{ t('common.optional') }}</UBadge>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <UFormField :label="t('auth.first_name')" name="prenom">
                  <UInput
                    v-model="state.prenom"
                    icon="i-heroicons-user"
                    :placeholder="t('profile.first_name_placeholder')"
                    size="lg"
                    class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                  />
                </UFormField>

                <UFormField :label="t('auth.last_name')" name="nom">
                  <UInput
                    v-model="state.nom"
                    icon="i-heroicons-user"
                    :placeholder="t('profile.last_name_placeholder')"
                    size="lg"
                    class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                  />
                </UFormField>
              </div>

              <UFormField :label="t('profile.phone')" name="telephone">
                <UInput
                  v-model="state.telephone"
                  icon="i-heroicons-phone"
                  type="tel"
                  :placeholder="t('profile.phone_placeholder')"
                  size="lg"
                  class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                />
              </UFormField>

              <UFormField :label="t('profile.preferred_language')" name="preferredLanguage">
                <USelect
                  v-model="state.preferredLanguage"
                  icon="i-heroicons-language"
                  :items="languageOptions"
                  size="lg"
                  class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                />
              </UFormField>
            </div>

            <!-- Actions avec indicateur de modifications -->
            <div class="border-t border-gray-100 dark:border-gray-700 pt-6">
              <div
                v-if="hasChanges"
                class="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
              >
                <div class="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
                  <span class="text-sm font-medium">{{ $t('profile.unsaved_changes') }}</span>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3 justify-between">
                <UButton
                  type="submit"
                  :loading="loading"
                  :disabled="!hasChanges"
                  icon="i-heroicons-check"
                  color="primary"
                  size="lg"
                  class="transition-all duration-200 hover:transform hover:scale-105"
                >
                  {{ loading ? t('profile.saving') : t('profile.save_changes') }}
                </UButton>

                <UButton
                  v-if="hasChanges"
                  type="button"
                  variant="outline"
                  color="neutral"
                  size="lg"
                  icon="i-heroicons-arrow-path"
                  class="transition-all duration-200 hover:transform hover:scale-105"
                  @click="resetForm"
                >
                  {{ $t('common.cancel') }}
                </UButton>
              </div>
            </div>
          </UForm>
        </UCard>

        <!-- Catégories utilisateur -->
        <ProfileUserCategoriesCard />

        <!-- Notifications -->
        <UCard class="shadow-lg border-0">
          <template #header>
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"
              >
                <UIcon name="i-heroicons-bell" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                  {{ $t('navigation.notifications') }}
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Gérer vos préférences de notifications
                </p>
              </div>
            </div>
          </template>

          <!-- Toggle Push Notifications -->
          <NotificationsPushNotificationToggle class="mb-8" />

          <div
            class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6"
          >
            <div class="flex items-center gap-4">
              <UIcon name="i-heroicons-cog-6-tooth" class="w-6 h-6 text-gray-400" />
              <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                  Préférences de notifications
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Configurez les types de notifications que vous souhaitez recevoir
                </p>
              </div>
            </div>
            <UButton
              icon="i-heroicons-cog-6-tooth"
              variant="soft"
              color="info"
              size="lg"
              class="w-full sm:w-auto transition-all duration-200 hover:transform hover:scale-105"
              @click="showNotificationPreferencesModal = true"
            >
              Gérer les notifications
            </UButton>
          </div>
        </UCard>
      </div>

      <!-- Statistiques -->
      <div class="space-y-6">
        <UCard
          class="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
        >
          <template #header>
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"
              >
                <UIcon
                  name="i-heroicons-chart-bar"
                  class="w-5 h-5 text-blue-600 dark:text-blue-400"
                />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ $t('profile.my_statistics') }}
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('profile.platform_activity') }}
                </p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <div
              class="group p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 transition-all duration-200 hover:shadow-md"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 bg-primary-100 dark:bg-primary-800 rounded-lg flex items-center justify-center"
                  >
                    <UIcon
                      name="i-heroicons-calendar-days"
                      class="w-4 h-4 text-primary-600 dark:text-primary-400"
                    />
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
                    $t('profile.conventions_created')
                  }}</span>
                </div>
                <UBadge color="primary" variant="soft" size="lg">
                  <UIcon
                    v-if="statsLoading"
                    name="i-heroicons-arrow-path"
                    class="animate-spin w-4 h-4"
                  />
                  <template v-else>{{ myConventionsCount }}</template>
                </UBadge>
              </div>
            </div>

            <div
              class="group p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 transition-all duration-200 hover:shadow-md"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 bg-yellow-100 dark:bg-yellow-800 rounded-lg flex items-center justify-center"
                  >
                    <UIcon
                      name="i-heroicons-star"
                      class="w-4 h-4 text-yellow-600 dark:text-yellow-400"
                    />
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
                    $t('profile.favorites')
                  }}</span>
                </div>
                <UBadge color="warning" variant="soft" size="lg">
                  <UIcon
                    v-if="statsLoading"
                    name="i-heroicons-arrow-path"
                    class="animate-spin w-4 h-4"
                  />
                  <template v-else>{{ favoritesCount }}</template>
                </UBadge>
              </div>
            </div>

            <div
              class="group p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 transition-all duration-200 hover:shadow-md"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 bg-red-100 dark:bg-red-800 rounded-lg flex items-center justify-center"
                  >
                    <UIcon
                      name="i-heroicons-heart"
                      class="w-4 h-4 text-red-600 dark:text-red-400"
                    />
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
                    $t('profile.favorites_received')
                  }}</span>
                </div>
                <UBadge color="error" variant="soft" size="lg">
                  <UIcon
                    v-if="statsLoading"
                    name="i-heroicons-arrow-path"
                    class="animate-spin w-4 h-4"
                  />
                  <template v-else>{{ totalFavoritesReceived }}</template>
                </UBadge>
              </div>
            </div>
          </div>
        </UCard>

        <UCard
          class="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
        >
          <template #header>
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center"
              >
                <UIcon name="i-heroicons-bolt" class="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ $t('profile.quick_actions') }}
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('profile.direct_access') }}
                </p>
              </div>
            </div>
          </template>

          <div class="space-y-3">
            <UButton
              icon="i-heroicons-plus"
              variant="soft"
              color="primary"
              size="lg"
              block
              to="/conventions/add"
              class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
            >
              {{ $t('profile.create_convention') }}
            </UButton>

            <UButton
              icon="i-heroicons-calendar-days"
              variant="soft"
              color="info"
              size="lg"
              block
              to="/my-conventions"
              class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
            >
              {{ $t('navigation.my_conventions') }}
            </UButton>

            <UButton
              icon="i-heroicons-star"
              variant="soft"
              color="warning"
              size="lg"
              block
              to="/favorites"
              class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
            >
              {{ $t('navigation.my_favorites') }}
            </UButton>
          </div>
        </UCard>

        <!-- Changement de mot de passe -->
        <UCard
          class="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
        >
          <template #header>
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center"
              >
                <UIcon
                  name="i-heroicons-shield-check"
                  class="w-5 h-5 text-red-600 dark:text-red-400"
                />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ $t('profile.security') }}
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('profile.manage_password') }}
                </p>
              </div>
            </div>
          </template>

          <UButton
            icon="i-heroicons-key"
            variant="soft"
            color="error"
            size="lg"
            block
            class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
            @click="showPasswordModal = true"
          >
            {{ userHasPassword ? $t('profile.change_password') : $t('profile.set_password') }}
          </UButton>
        </UCard>
      </div>
    </div>

    <!-- Modal pour changement de mot de passe -->
    <UModal v-model:open="showPasswordModal" size="md" :title="$t('profile.change_password')">
      <template #header>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center"
          >
            <UIcon name="i-heroicons-key" class="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ $t('profile.change_password') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{
                userHasPassword
                  ? $t('profile.enter_current_new_password')
                  : $t('profile.enter_new_password')
              }}
            </p>
          </div>
        </div>
      </template>

      <template #body>
        <UForm
          :state="passwordState"
          :schema="passwordSchema"
          class="space-y-6"
          @submit="changePassword"
        >
          <UFormField
            v-if="userHasPassword"
            :label="t('profile.current_password')"
            name="currentPassword"
          >
            <UInput
              v-model="passwordState.currentPassword"
              type="password"
              icon="i-heroicons-lock-closed"
              required
              :placeholder="t('profile.current_password_placeholder')"
              size="lg"
              class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
            />
          </UFormField>

          <UAlert
            v-else
            icon="i-heroicons-information-circle"
            color="info"
            variant="soft"
            class="mb-4"
          >
            <template #title>
              {{ $t('profile.no_password_set') }}
            </template>
            <template #description>
              {{ $t('profile.oauth_password_info') }}
            </template>
          </UAlert>

          <UFormField :label="t('profile.new_password')" name="newPassword">
            <UInput
              v-model="passwordState.newPassword"
              type="password"
              icon="i-heroicons-key"
              required
              :placeholder="t('profile.new_password_placeholder')"
              size="lg"
              class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
            />
          </UFormField>

          <UFormField :label="t('auth.confirm_new_password')" name="confirmPassword">
            <UInput
              v-model="passwordState.confirmPassword"
              type="password"
              icon="i-heroicons-shield-check"
              required
              :placeholder="t('profile.confirm_new_password_placeholder')"
              size="lg"
              class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
            />
          </UFormField>

          <div class="flex flex-col sm:flex-row gap-3 justify-end">
            <UButton
              type="button"
              variant="outline"
              color="neutral"
              size="lg"
              class="transition-all duration-200 hover:transform hover:scale-105"
              @click="showPasswordModal = false"
            >
              {{ $t('common.cancel') }}
            </UButton>
            <UButton
              type="submit"
              :loading="passwordLoading"
              color="error"
              size="lg"
              icon="i-heroicons-key"
              class="transition-all duration-200 hover:transform hover:scale-105"
            >
              {{ passwordLoading ? t('profile.changing') : t('profile.change_password') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal pour photo de profil -->
    <UModal
      v-model:open="showProfilePictureModal"
      size="md"
      :title="$t('profile.picture')"
      :description="$t('profile.customize_avatar')"
      :prevent-close="profilePictureUrl !== (authStore.user?.profilePicture || '')"
    >
      <template #body>
        <div class="space-y-8">
          <!-- Aperçu actuel -->
          <div class="flex justify-center">
            <UiUserAvatar
              v-if="authStore.user"
              :user="getPreviewUser()"
              :size="128"
              border
              class="border-primary-200 dark:border-primary-700 shadow-xl"
            />
          </div>

          <!-- Upload de photo -->
          <div>
            <UiImageUpload
              v-model="profilePictureUrl"
              :endpoint="{ type: 'profile', id: authStore.user?.id }"
              :options="{
                validation: {
                  maxSize: 5 * 1024 * 1024,
                  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
                },
                resetAfterUpload: false,
              }"
              :alt="$t('pages.profile.photo_alt')"
              :placeholder="$t('pages.profile.photo_placeholder')"
              :allow-delete="!!authStore.user?.profilePicture"
              @uploaded="onProfilePictureTemporarilyUploaded"
              @deleted="onProfilePictureDeleted"
              @error="onProfilePictureError"
            />
          </div>

          <!-- Informations -->
          <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-information-circle"
                class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
              />
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {{ $t('profile.important_info') }}
                </p>
                <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li>{{ $t('profile.formats_accepted') }}</li>
                  <li>{{ $t('profile.max_size') }}</li>
                  <li>{{ $t('profile.recommended_resolution') }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="outline" @click="cancelProfilePictureChanges">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            :disabled="profilePictureUrl === (authStore.user?.profilePicture || '')"
            :loading="pictureValidationLoading"
            @click="validateProfilePictureChanges"
          >
            {{ $t('common.validate') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal de préférences de notifications -->
    <UModal
      v-model:open="showNotificationPreferencesModal"
      size="lg"
      :title="$t('navigation.notifications')"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"
          >
            <UIcon name="i-heroicons-bell" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Préférences de notifications
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Choisissez les types de notifications que vous souhaitez recevoir
            </p>
          </div>
        </div>
      </template>

      <template #body>
        <div class="space-y-6">
          <!-- Rappels de créneaux bénévoles -->
          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-clock"
                    class="w-4 h-4 text-orange-600 dark:text-orange-400"
                  />
                </div>
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">
                    Rappels de créneaux bénévoles
                  </h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Notifications 30 minutes avant vos créneaux
                  </p>
                </div>
              </div>
              <USwitch
                v-model="notificationPreferences.volunteerReminders"
                color="primary"
                size="lg"
              />
            </div>
            <div class="flex items-center justify-between pl-11">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-600 dark:text-gray-400">Recevoir par email</span>
              </div>
              <USwitch
                v-model="notificationPreferences.emailVolunteerReminders"
                :disabled="!notificationPreferences.volunteerReminders"
                color="primary"
                size="md"
              />
            </div>
          </div>

          <!-- Mises à jour de candidatures -->
          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-hand-raised"
                    class="w-4 h-4 text-green-600 dark:text-green-400"
                  />
                </div>
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">Candidatures bénévoles</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Acceptation, refus ou modifications de vos candidatures
                  </p>
                </div>
              </div>
              <USwitch
                v-model="notificationPreferences.applicationUpdates"
                color="primary"
                size="lg"
              />
            </div>
            <div class="flex items-center justify-between pl-11">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-600 dark:text-gray-400">Recevoir par email</span>
              </div>
              <USwitch
                v-model="notificationPreferences.emailApplicationUpdates"
                :disabled="!notificationPreferences.applicationUpdates"
                color="primary"
                size="md"
              />
            </div>
          </div>

          <!-- Nouvelles conventions -->
          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-calendar-days"
                    class="w-4 h-4 text-blue-600 dark:text-blue-400"
                  />
                </div>
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">Nouvelles conventions</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Notifications des nouvelles conventions ajoutées
                  </p>
                </div>
              </div>
              <USwitch v-model="notificationPreferences.conventionNews" color="primary" size="lg" />
            </div>
            <div class="flex items-center justify-between pl-11">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-600 dark:text-gray-400">Recevoir par email</span>
              </div>
              <USwitch
                v-model="notificationPreferences.emailConventionNews"
                :disabled="!notificationPreferences.conventionNews"
                color="primary"
                size="md"
              />
            </div>
          </div>

          <!-- Covoiturage -->
          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-truck"
                    class="w-4 h-4 text-purple-600 dark:text-purple-400"
                  />
                </div>
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">Covoiturage</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Demandes, confirmations et annulations de covoiturage
                  </p>
                </div>
              </div>
              <USwitch v-model="notificationPreferences.carpoolUpdates" color="primary" size="lg" />
            </div>
            <div class="flex items-center justify-between pl-11">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-600 dark:text-gray-400">Recevoir par email</span>
              </div>
              <USwitch
                v-model="notificationPreferences.emailCarpoolUpdates"
                :disabled="!notificationPreferences.carpoolUpdates"
                color="primary"
                size="md"
              />
            </div>
          </div>

          <!-- Notifications système -->
          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 bg-gray-100 dark:bg-gray-900/30 rounded-lg flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-cog-6-tooth"
                    class="w-4 h-4 text-gray-600 dark:text-gray-400"
                  />
                </div>
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">Notifications système</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Mises à jour importantes et maintenance
                  </p>
                </div>
              </div>
              <USwitch
                v-model="notificationPreferences.systemNotifications"
                color="primary"
                size="lg"
              />
            </div>
            <div class="flex items-center justify-between pl-11">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-600 dark:text-gray-400">Recevoir par email</span>
              </div>
              <USwitch
                v-model="notificationPreferences.emailSystemNotifications"
                :disabled="!notificationPreferences.systemNotifications"
                color="primary"
                size="md"
              />
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="outline" @click="showNotificationPreferencesModal = false">
            Annuler
          </UButton>
          <UButton
            :loading="notificationPreferencesLoading"
            icon="i-heroicons-check"
            @click="saveNotificationPreferences"
          >
            {{ notificationPreferencesLoading ? 'Sauvegarde...' : 'Sauvegarder' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { z } from 'zod'

import { useAuthStore } from '~/stores/auth'
import type { User } from '~/types'
import { LOCALES_CONFIG } from '~/utils/locales'

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected',
})

const authStore = useAuthStore()
const toast = useToast()
const { locale, t } = useI18n()

// Statistiques du profil via l'API
const {
  stats: profileStats,
  loading: statsLoading,
  ensureInitialized: initStats,
} = useProfileStats()

// Computed pour formater la date d'inscription
const formatMemberSince = computed(() => {
  const createdAt = authStore.user?.createdAt || Date.now()
  const date = new Date(createdAt)
  const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US'
  return date.toLocaleDateString(localeCode, { year: 'numeric', month: 'long' })
})

const showPasswordModal = ref(false)
const showProfilePictureModal = ref(false)
const showNotificationPreferencesModal = ref(false)
const userHasPassword = ref(true) // Par défaut, on suppose qu'il a un mot de passe
const profilePictureUrl = ref(authStore.user?.profilePicture || '')
const avatarKey = ref(Date.now()) // Pour forcer le rechargement de l'avatar
const pictureValidationLoading = ref(false) // Loading lors de la validation

// État des préférences de notifications
const notificationPreferences = reactive({
  volunteerReminders: true, // Rappels de créneaux bénévoles
  applicationUpdates: true, // Mises à jour de candidatures
  conventionNews: true, // Nouvelles conventions
  systemNotifications: true, // Notifications système
  carpoolUpdates: true, // Covoiturage
  // Préférences email pour chaque type
  emailVolunteerReminders: true,
  emailApplicationUpdates: true,
  emailConventionNews: true,
  emailSystemNotifications: true,
  emailCarpoolUpdates: true,
})

// Options de langues disponibles (basées sur la configuration centralisée)
const languageOptions = LOCALES_CONFIG.map((locale) => ({
  value: locale.code,
  label: locale.name,
}))

// Schéma de validation pour le profil
const schema = z.object({
  email: z.string().email(t('errors.invalid_email')),
  pseudo: z.string().min(3, t('profile.username_min_3')),
  nom: z.string().optional(),
  prenom: z.string().optional(),
  telephone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[0-9\s\-()]+$/.test(val), t('errors.invalid_phone_number')),
  preferredLanguage: z.string().optional(),
})

// Schéma pour le changement de mot de passe
const passwordSchema = computed(() => {
  const baseSchema = {
    newPassword: z
      .string()
      .min(8, t('errors.password_too_short'))
      .regex(/(?=.*[A-Z])/, t('profile.password_uppercase_required'))
      .regex(/(?=.*\d)/, t('profile.password_digit_required')),
    confirmPassword: z.string(),
  }

  // Ajouter currentPassword seulement si l'utilisateur a déjà un mot de passe
  if (userHasPassword.value) {
    return z
      .object({
        currentPassword: z.string().min(1, t('profile.current_password_required')),
        ...baseSchema,
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: t('profile.passwords_dont_match'),
        path: ['confirmPassword'],
      })
  }

  return z.object(baseSchema).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('profile.passwords_dont_match'),
    path: ['confirmPassword'],
  })
})

// État du formulaire principal
const state = reactive({
  email: authStore.user?.email || '',
  pseudo: authStore.user?.pseudo || '',
  nom: (authStore.user as any)?.nom || '',
  prenom: (authStore.user as any)?.prenom || '',
  telephone: (authStore.user as any)?.telephone || (authStore.user as any)?.phone || '',
  preferredLanguage: (authStore.user as any)?.preferredLanguage || 'fr',
})

// État du formulaire de mot de passe
const passwordState = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

// Détection des changements
const hasChanges = computed(() => {
  return (
    state.email !== (authStore.user?.email || '') ||
    state.pseudo !== (authStore.user?.pseudo || '') ||
    state.nom !== ((authStore.user as any)?.nom || '') ||
    state.prenom !== ((authStore.user as any)?.prenom || '') ||
    state.telephone !==
      ((authStore.user as any)?.telephone || (authStore.user as any)?.phone || '') ||
    state.preferredLanguage !== ((authStore.user as any)?.preferredLanguage || 'fr')
  )
})

// Statistiques basées sur l'API au lieu des calculs côté client
const myConventionsCount = computed(() => profileStats.value?.conventionsCreated ?? 0)
const favoritesCount = computed(() => profileStats.value?.editionsFavorited ?? 0)
const totalFavoritesReceived = computed(() => profileStats.value?.favoritesReceived ?? 0)

const resetForm = () => {
  state.email = authStore.user?.email || ''
  state.pseudo = authStore.user?.pseudo || ''
  state.nom = (authStore.user as any)?.nom || ''
  state.prenom = (authStore.user as any)?.prenom || ''
  state.telephone = (authStore.user as any)?.telephone || (authStore.user as any)?.phone || ''
  state.preferredLanguage = (authStore.user as any)?.preferredLanguage || 'fr'
}

// Action pour mettre à jour le profil
const { execute: executeUpdateProfile, loading } = useApiAction<unknown, User>(
  '/api/profile/update',
  {
    method: 'PUT',
    body: () => ({
      email: state.email,
      pseudo: state.pseudo,
      nom: state.nom || '',
      prenom: state.prenom || '',
      telephone: state.telephone || '',
      preferredLanguage: state.preferredLanguage || 'fr',
    }),
    successMessage: {
      title: t('profile.profile_updated'),
      description: t('profile.info_saved'),
    },
    errorMessages: { default: t('profile.cannot_save_profile') },
    onSuccess: (updatedUser) => {
      authStore.updateUser({ ...authStore.user!, ...updatedUser })
    },
  }
)

const updateProfile = () => {
  if (!hasChanges.value) return
  executeUpdateProfile()
}

// Action pour changer le mot de passe
const buildPasswordPayload = () => {
  const body: Record<string, string> = {
    newPassword: passwordState.newPassword,
    confirmPassword: passwordState.confirmPassword,
  }
  // Ajouter currentPassword seulement si l'utilisateur a déjà un mot de passe
  if (userHasPassword.value) {
    body.currentPassword = passwordState.currentPassword
  }
  return body
}

const { execute: executeChangePassword, loading: passwordLoading } = useApiAction(
  '/api/profile/change-password',
  {
    method: 'POST',
    body: buildPasswordPayload,
    successMessage: {
      title: t('profile.password_changed'),
      description: t('profile.password_updated'),
    },
    errorMessages: { default: t('profile.cannot_change_password') },
    onSuccess: () => {
      showPasswordModal.value = false
      passwordState.currentPassword = ''
      passwordState.newPassword = ''
      passwordState.confirmPassword = ''
    },
  }
)

const changePassword = () => {
  executeChangePassword()
}

// Gestionnaires d'événements pour ImageUpload
const onProfilePictureTemporarilyUploaded = async (result: {
  success: boolean
  imageUrl?: string
  user?: User
}) => {
  if (result.success && result.imageUrl) {
    profilePictureUrl.value = result.imageUrl
  }
}

const onProfilePictureDeleted = () => {
  // Simple suppression comme dans ConventionForm
  profilePictureUrl.value = ''
}

// Validation des changements de photo de profil
const validateProfilePictureChanges = async () => {
  // Vérifier s'il y a des changements
  if (profilePictureUrl.value === (authStore.user?.profilePicture || '')) return

  pictureValidationLoading.value = true

  try {
    // Déterminer la valeur à envoyer
    const profilePictureValue = profilePictureUrl.value || null

    // Sauvegarder les changements (nouvelle photo ou suppression)
    const updatedUser = await $fetch('/api/profile/update', {
      method: 'PUT',
      body: {
        email: authStore.user?.email,
        pseudo: authStore.user?.pseudo,
        nom: authStore.user?.nom,
        prenom: authStore.user?.prenom,
        telephone: authStore.user?.phone,
        profilePicture: profilePictureValue,
      },
    })

    // Mettre à jour les données utilisateur avec le résultat de l'API
    if (updatedUser) {
      authStore.updateUser(updatedUser)
      profilePictureUrl.value = updatedUser.profilePicture || ''
    }

    const isDelete = !profilePictureValue
    toast.add({
      title: isDelete ? t('profile.photo_deleted') : t('profile.photo_updated'),
      description: isDelete
        ? t('profile.profile_picture_deleted')
        : t('profile.profile_picture_changed'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Forcer le rechargement de l'avatar et fermer la modal
    avatarKey.value++
    resetProfilePictureModal()
    showProfilePictureModal.value = false
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la photo de profil:', error)
    toast.add({
      title: t('common.error'),
      description: t('profile.cannot_change_photo'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    pictureValidationLoading.value = false
  }
}

// Annuler les changements de photo de profil
const cancelProfilePictureChanges = () => {
  resetProfilePictureModal()
  showProfilePictureModal.value = false
}

// Ouvrir la modal de photo de profil
const openProfilePictureModal = () => {
  resetProfilePictureModal()
  showProfilePictureModal.value = true
}

// Reset de l'état de la modal de photo de profil
const resetProfilePictureModal = () => {
  pictureValidationLoading.value = false
  profilePictureUrl.value = authStore.user?.profilePicture || ''
}

// Obtenir l'utilisateur pour l'aperçu (avec image du formulaire)
const getPreviewUser = () => {
  if (!authStore.user) return authStore.user

  // Utiliser l'image du formulaire pour l'aperçu
  return { ...authStore.user, profilePicture: profilePictureUrl.value || null }
}

const onProfilePictureError = (error: string) => {
  toast.add({
    title: t('common.error'),
    description: error || t('profile.cannot_change_photo'),
    icon: 'i-heroicons-x-circle',
    color: 'error',
  })
}

// Fonction pour charger les préférences de notifications
const loadNotificationPreferences = async () => {
  try {
    const response = await $fetch<{
      success: boolean
      preferences: typeof notificationPreferences
    }>('/api/profile/notification-preferences')
    Object.assign(notificationPreferences, response.preferences)
  } catch (error) {
    console.error('Erreur lors du chargement des préférences:', error)
    // En cas d'erreur, garder les valeurs par défaut (tout activé)
  }
}

// Action pour sauvegarder les préférences de notifications
const { execute: executeSaveNotificationPreferences, loading: notificationPreferencesLoading } =
  useApiAction('/api/profile/notification-preferences', {
    method: 'PUT',
    body: () => ({ ...notificationPreferences }),
    successMessage: {
      title: t('profile.preferences_saved'),
      description: t('profile.notification_preferences_updated'),
    },
    errorMessages: { default: t('profile.cannot_save_preferences') },
    onSuccess: () => {
      showNotificationPreferencesModal.value = false
    },
  })

const saveNotificationPreferences = () => {
  executeSaveNotificationPreferences()
}

onMounted(async () => {
  // Charger les statistiques du profil
  await initStats()

  // Charger les préférences de notifications
  await loadNotificationPreferences()

  // Vérifier si l'utilisateur a un mot de passe
  try {
    const { hasPassword } = await $fetch('/api/profile/has-password')
    userHasPassword.value = hasPassword
  } catch (error) {
    console.error('Erreur lors de la vérification du mot de passe:', error)
    // En cas d'erreur, on suppose qu'il a un mot de passe pour la sécurité
    userHasPassword.value = true
  }
})
</script>
