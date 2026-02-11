<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-megaphone"
        :title="t('sections.showCalls.title')"
        color="yellow"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.showCalls.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.showCalls.create.title') }}
        </h3>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.showCalls.create.mode')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.showCalls.create.name')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.showCalls.create.description')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.showCalls.create.deadline')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.showCalls.create.activate')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-inbox-stack"
        :title="t('sections.applications.title')"
        color="yellow"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.applications.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.applications.list')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.applications.details')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.applications.accept')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.applications.reject')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.applications.notification')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-play-circle"
        :title="t('sections.shows.title')"
        color="yellow"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.shows.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.shows.create.title') }}
        </h3>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.shows.create.titleField')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.shows.create.description')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.shows.create.image')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.shows.create.dateTime')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.shows.create.duration')
            }}</span>
          </li>
        </ul>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.shows.location.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.shows.location.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.shows.location.zone')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.shows.location.marker')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.shows.location.text')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-link" :title="t('sections.artists.title')" color="yellow">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.artists.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.artists.assign') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.artists.multiple')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-archive-box"
        :title="t('sections.returnableItems.title')"
        color="yellow"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.returnableItems.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.returnableItems.assign')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.returnableItems.examples')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.returnableItems.tracking')
            }}</span>
          </li>
        </ul>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({ layout: 'guide', title: 'Guide - Artistes & Spectacles' })

useHead({
  title: 'Guide Artistes & Spectacles | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide organisateur : appels à spectacles, gestion des candidatures artistiques, programmation des spectacles.',
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Artistes & Spectacles",
    "subtitle": "Recrutez des artistes et programmez les spectacles de votre édition.",
    "sections": {
      "showCalls": {
        "title": "Appels à spectacles",
        "intro": "Publiez des appels à spectacles pour recruter des artistes.",
        "create": {
          "title": "Créer un appel",
          "mode": "Choisissez le mode : intégré (formulaire sur la plateforme) ou externe (lien vers un formulaire tiers).",
          "name": "Donnez un nom à l'appel (ex : « Appel à spectacles — Édition 2025 »).",
          "description": "Décrivez les types de numéros recherchés, les conditions d'accueil et les avantages proposés.",
          "deadline": "Fixez une date limite de candidature.",
          "activate": "Activez ou désactivez l'appel à tout moment."
        }
      },
      "applications": {
        "title": "Gestion des candidatures",
        "intro": "Traitez les candidatures reçues pour vos appels à spectacles.",
        "list": "Consultez la liste de toutes les candidatures avec leur statut (en attente, acceptée, refusée).",
        "details": "Accédez aux détails de chaque proposition : titre, description, durée, artistes supplémentaires, besoins techniques.",
        "accept": "Acceptez les candidatures qui correspondent à votre programmation.",
        "reject": "Refusez les candidatures qui ne conviennent pas.",
        "notification": "Les artistes sont automatiquement notifiés de votre décision par e-mail et notification push."
      },
      "shows": {
        "title": "Programmation des spectacles",
        "intro": "Créez et gérez le programme complet des spectacles de votre édition.",
        "create": {
          "title": "Informations du spectacle",
          "titleField": "Titre du spectacle.",
          "description": "Description détaillée du numéro.",
          "image": "Image d'illustration (affiche du spectacle).",
          "dateTime": "Date et heure de début.",
          "duration": "Durée en minutes."
        },
        "location": {
          "title": "Localisation du spectacle",
          "intro": "Trois options pour indiquer où se déroule le spectacle :",
          "zone": "Zone sur la carte : associez le spectacle à une zone définie (scène principale, chapiteau, etc.).",
          "marker": "Marqueur sur la carte : placez le spectacle sur un point d'intérêt précis.",
          "text": "Adresse textuelle : indiquez simplement le nom du lieu."
        }
      },
      "artists": {
        "title": "Assigner des artistes",
        "intro": "Associez des artistes à chaque spectacle.",
        "assign": "Sélectionnez un ou plusieurs artistes pour chaque spectacle depuis la liste des artistes de l'édition.",
        "multiple": "Un spectacle peut impliquer plusieurs artistes (spectacle collectif, collaboration)."
      },
      "returnableItems": {
        "title": "Articles à restituer",
        "intro": "Gérez les articles prêtés aux artistes pendant l'édition.",
        "assign": "Attribuez des articles spécifiques à chaque spectacle ou artiste.",
        "examples": "Exemples : badges d'accès, pass backstage, clés de loge, matériel technique.",
        "tracking": "Suivez la restitution des articles à la fin de l'événement."
      }
    }
  }
}
</i18n>
