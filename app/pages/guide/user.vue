<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-magnifying-glass"
        :title="t('sections.discover.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.discover.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.discover.search.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.discover.search.content') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.discover.views.title') }}
        </h3>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.discover.views.grid') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.discover.views.calendar') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.discover.views.map') }}</span>
          </li>
        </ul>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.discover.details.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.discover.details.content') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-heart"
        :title="t('sections.favorites.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.favorites.content') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.favorites.add') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.favorites.page') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-hand-thumb-up"
        :title="t('sections.participate.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.participate.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.participate.attendance.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.participate.attendance.content') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.participate.carpool.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.participate.carpool.content') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.participate.posts.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.participate.posts.content') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-user-circle"
        :title="t('sections.profile.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.profile.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.profile.info') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.profile.photo') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.profile.notifications') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.profile.language') }}</span>
          </li>
        </ul>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({
  layout: 'guide',
  title: 'Guide - Utilisateur',
})

useHead({
  title: 'Guide Utilisateur | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide des fonctionnalités pour les utilisateurs : découvrir les conventions, gérer ses favoris, participer et personnaliser son profil.',
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Guide Utilisateur",
    "subtitle": "Découvrez les conventions de jonglerie et participez à la communauté.",
    "sections": {
      "discover": {
        "title": "Découvrir les conventions",
        "intro": "La page d'accueil vous permet d'explorer toutes les conventions de jonglerie référencées sur la plateforme.",
        "search": {
          "title": "Recherche et filtres",
          "content": "Utilisez la barre de recherche pour trouver une convention par nom. Les filtres avancés vous permettent d'affiner par pays, période, services proposés (camping, restauration, etc.) et bien plus encore."
        },
        "views": {
          "title": "Différentes vues",
          "grid": "Vue grille : parcourez toutes les éditions sous forme de cartes avec leurs informations clés (dates, lieu, services).",
          "calendar": "Vue calendrier : visualisez les conventions sur un calendrier mensuel pour repérer facilement les dates.",
          "map": "Vue carte : explorez géographiquement les conventions sur une carte interactive."
        },
        "details": {
          "title": "Détails d'une édition",
          "content": "Cliquez sur une édition pour accéder à sa page complète : description, dates, lieu, carte interactive, programme des spectacles, covoiturage et publications."
        }
      },
      "favorites": {
        "title": "Gérer ses favoris",
        "content": "Marquez vos conventions préférées pour les retrouver facilement.",
        "add": "Cliquez sur l'icône étoile sur une édition pour l'ajouter à vos favoris.",
        "page": "Retrouvez tous vos favoris dans la page « Mes favoris » accessible depuis le menu."
      },
      "participate": {
        "title": "Participer à une édition",
        "intro": "Plusieurs fonctionnalités vous permettent de participer activement aux conventions.",
        "attendance": {
          "title": "Indiquer sa participation",
          "content": "Sur la page d'une édition, cliquez sur le bouton « Je participe » pour signaler votre présence. Cela permet aux organisateurs de mieux anticiper le nombre de participants."
        },
        "carpool": {
          "title": "Covoiturage",
          "content": "Proposez un trajet ou recherchez un covoiturage pour vous rendre à la convention. Vous pouvez indiquer votre point de départ, le nombre de places disponibles et vos préférences."
        },
        "posts": {
          "title": "Publications et commentaires",
          "content": "Participez aux échanges en publiant des messages ou en commentant les publications des autres participants sur le fil d'actualité de l'édition."
        }
      },
      "profile": {
        "title": "Mon profil",
        "intro": "Personnalisez votre expérience en configurant votre profil.",
        "info": "Modifiez vos informations personnelles (nom, prénom, pseudo).",
        "photo": "Ajoutez ou changez votre photo de profil.",
        "notifications": "Configurez vos préférences de notifications (e-mail, push).",
        "language": "Changez la langue de l'interface via le sélecteur en bas de page."
      }
    }
  }
}
</i18n>
