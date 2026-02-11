<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-light-bulb"
        :title="t('sections.concept.title')"
        color="purple"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.concept.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.concept.convention.label') }}</strong> —
              {{ t('sections.concept.convention.desc') }}</span
            >
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.concept.edition.label') }}</strong> —
              {{ t('sections.concept.edition.desc') }}</span
            >
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-plus-circle"
        :title="t('sections.createConvention.title')"
        color="purple"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.createConvention.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.createConvention.name')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.createConvention.description')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.createConvention.logo')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-flag" :title="t('sections.claim.title')" color="purple">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.claim.content') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-calendar-days"
        :title="t('sections.addEdition.title')"
        color="purple"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.addEdition.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.addEdition.dates')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.addEdition.location')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.addEdition.gps') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.addEdition.services')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.addEdition.price')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.addEdition.poster')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-signal" :title="t('sections.statuses.title')" color="purple">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.statuses.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.statuses.offline.label') }}</strong> —
              {{ t('sections.statuses.offline.desc') }}</span
            >
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.statuses.planned.label') }}</strong> —
              {{ t('sections.statuses.planned.desc') }}</span
            >
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.statuses.published.label') }}</strong> —
              {{ t('sections.statuses.published.desc') }}</span
            >
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.statuses.cancelled.label') }}</strong> —
              {{ t('sections.statuses.cancelled.desc') }}</span
            >
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-cog-6-tooth"
        :title="t('sections.manage.title')"
        color="purple"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.manage.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.manage.edit') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.manage.delete') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.manage.dashboard')
            }}</span>
          </li>
        </ul>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({ layout: 'guide', title: 'Guide - Conventions & Éditions' })

useHead({
  title: 'Guide Conventions & Éditions | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide organisateur : créer une convention, ajouter des éditions, gérer les statuts et configurer vos événements.',
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Conventions & Éditions",
    "subtitle": "Créez et configurez vos conventions et leurs éditions.",
    "sections": {
      "concept": {
        "title": "Concept : Convention vs Édition",
        "intro": "La plateforme distingue deux niveaux d'organisation :",
        "convention": {
          "label": "Convention",
          "desc": "l'événement récurrent dans son ensemble (ex : « Convention de Jonglerie de Paris »). Elle regroupe toutes les éditions passées et futures."
        },
        "edition": {
          "label": "Édition",
          "desc": "une occurrence précise de la convention (ex : « Édition 2025 »). Chaque édition a ses propres dates, lieu, équipe et configuration."
        }
      },
      "createConvention": {
        "title": "Créer une convention",
        "intro": "Depuis votre espace, créez une nouvelle convention en renseignant :",
        "name": "Nom de la convention.",
        "description": "Description en texte enrichi (Markdown supporté).",
        "logo": "Logo ou image de la convention."
      },
      "claim": {
        "title": "Revendiquer une convention existante",
        "content": "Si une convention existe déjà sur la plateforme (créée par un autre organisateur ou importée), vous pouvez demander à en devenir organisateur. Votre demande sera examinée par les administrateurs."
      },
      "addEdition": {
        "title": "Ajouter une édition",
        "intro": "Une fois votre convention créée, ajoutez une édition en précisant :",
        "dates": "Dates de début et de fin de l'événement.",
        "location": "Lieu (ville, adresse, pays).",
        "gps": "Coordonnées GPS pour la carte interactive.",
        "services": "Services disponibles (camping, repas, douches, parking, etc.).",
        "price": "Fourchette de prix indicative.",
        "poster": "Affiche de l'édition."
      },
      "statuses": {
        "title": "Statuts d'édition",
        "intro": "Chaque édition passe par différents statuts :",
        "offline": {
          "label": "Hors ligne",
          "desc": "l'édition est en préparation et n'est pas visible publiquement."
        },
        "planned": {
          "label": "Planifiée",
          "desc": "les dates sont confirmées mais les détails sont encore en cours."
        },
        "published": {
          "label": "Publiée",
          "desc": "l'édition est visible par tous et les inscriptions peuvent commencer."
        },
        "cancelled": {
          "label": "Annulée",
          "desc": "l'édition a été annulée. Les participants inscrits sont notifiés."
        }
      },
      "manage": {
        "title": "Gérer une édition",
        "intro": "Depuis le tableau de bord de l'édition, vous pouvez :",
        "edit": "Modifier toutes les informations de l'édition à tout moment.",
        "delete": "Supprimer l'édition (action irréversible, nécessite une confirmation).",
        "dashboard": "Accéder au tableau de bord complet pour gérer tous les aspects : bénévoles, artistes, billetterie, carte, etc."
      }
    }
  }
}
</i18n>
