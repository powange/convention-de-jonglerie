<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection icon="i-heroicons-user-plus" :title="t('sections.add.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.add.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.add.search') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.add.customTitle') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.add.notification') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-shield-check" :title="t('sections.conventionPerms.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.conventionPerms.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.conventionPerms.editConvention.label') }}</strong> — {{ t('sections.conventionPerms.editConvention.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.conventionPerms.deleteConvention.label') }}</strong> — {{ t('sections.conventionPerms.deleteConvention.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.conventionPerms.manageOrganizers.label') }}</strong> — {{ t('sections.conventionPerms.manageOrganizers.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.conventionPerms.manageVolunteers.label') }}</strong> — {{ t('sections.conventionPerms.manageVolunteers.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.conventionPerms.addEdition.label') }}</strong> — {{ t('sections.conventionPerms.addEdition.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.conventionPerms.editAllEditions.label') }}</strong> — {{ t('sections.conventionPerms.editAllEditions.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.conventionPerms.deleteAllEditions.label') }}</strong> — {{ t('sections.conventionPerms.deleteAllEditions.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.conventionPerms.manageMeals.label') }}</strong> — {{ t('sections.conventionPerms.manageMeals.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.conventionPerms.manageTicketing.label') }}</strong> — {{ t('sections.conventionPerms.manageTicketing.desc') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-key" :title="t('sections.editionPerms.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.editionPerms.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.editionPerms.manageArtists.label') }}</strong> — {{ t('sections.editionPerms.manageArtists.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.editionPerms.manageVolunteers.label') }}</strong> — {{ t('sections.editionPerms.manageVolunteers.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.editionPerms.manageShows.label') }}</strong> — {{ t('sections.editionPerms.manageShows.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.editionPerms.manageMap.label') }}</strong> — {{ t('sections.editionPerms.manageMap.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.editionPerms.manageTicketing.label') }}</strong> — {{ t('sections.editionPerms.manageTicketing.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.editionPerms.manageMeals.label') }}</strong> — {{ t('sections.editionPerms.manageMeals.desc') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-map-pin" :title="t('sections.presence.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.presence.content') }}</p>
      </GuideSection>

      <GuideSection icon="i-heroicons-clock" :title="t('sections.history.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.history.content') }}</p>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({ layout: 'guide', title: 'Guide - Co-organisateurs' })

useHead({
  title: 'Guide Co-organisateurs | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide organisateur : inviter des co-organisateurs, gérer les permissions granulaires par convention et par édition.',
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Co-organisateurs & Permissions",
    "subtitle": "Invitez des collaborateurs et gérez finement les droits d'accès.",
    "sections": {
      "add": {
        "title": "Ajouter un co-organisateur",
        "intro": "Invitez des personnes à rejoindre l'équipe d'organisation.",
        "search": "Recherchez un utilisateur par e-mail ou par nom pour l'ajouter comme co-organisateur.",
        "customTitle": "Attribuez un titre personnalisé (ex : « Responsable bénévoles », « Trésorier »).",
        "notification": "L'utilisateur invité reçoit une notification et est automatiquement ajouté à l'équipe."
      },
      "conventionPerms": {
        "title": "Permissions au niveau convention",
        "intro": "Les permissions de convention s'appliquent à toutes les éditions de cette convention :",
        "editConvention": {
          "label": "Modifier la convention",
          "desc": "permet de modifier les informations de la convention (nom, description, logo)."
        },
        "deleteConvention": {
          "label": "Supprimer la convention",
          "desc": "permet de supprimer la convention entière."
        },
        "manageOrganizers": {
          "label": "Gérer les organisateurs",
          "desc": "permet d'ajouter/supprimer des co-organisateurs et de modifier leurs permissions."
        },
        "manageVolunteers": {
          "label": "Gérer les bénévoles",
          "desc": "permet de gérer les bénévoles sur toutes les éditions."
        },
        "addEdition": {
          "label": "Ajouter des éditions",
          "desc": "permet de créer de nouvelles éditions."
        },
        "editAllEditions": {
          "label": "Modifier toutes les éditions",
          "desc": "permet de modifier toutes les éditions existantes."
        },
        "deleteAllEditions": {
          "label": "Supprimer toutes les éditions",
          "desc": "permet de supprimer n'importe quelle édition."
        },
        "manageMeals": {
          "label": "Gérer les repas",
          "desc": "permet de gérer la configuration des repas."
        },
        "manageTicketing": {
          "label": "Gérer la billetterie",
          "desc": "permet de gérer la billetterie sur toutes les éditions."
        }
      },
      "editionPerms": {
        "title": "Permissions par édition",
        "intro": "Des permissions supplémentaires peuvent être attribuées spécifiquement pour une édition :",
        "manageArtists": {
          "label": "Artistes",
          "desc": "gérer les appels à spectacles et les candidatures artistiques."
        },
        "manageVolunteers": {
          "label": "Bénévoles",
          "desc": "gérer les candidatures bénévoles, les équipes et le planning."
        },
        "manageShows": {
          "label": "Spectacles",
          "desc": "créer et programmer les spectacles."
        },
        "manageMap": {
          "label": "Carte",
          "desc": "gérer la carte interactive (zones et marqueurs)."
        },
        "manageTicketing": {
          "label": "Billetterie",
          "desc": "gérer la billetterie de cette édition."
        },
        "manageMeals": {
          "label": "Repas",
          "desc": "gérer les repas de cette édition."
        }
      },
      "presence": {
        "title": "Présence sur l'édition",
        "content": "Indiquez quels organisateurs seront physiquement présents lors de l'édition. Cette information est utile pour la coordination sur place et peut être affichée aux bénévoles et participants."
      },
      "history": {
        "title": "Historique",
        "content": "Consultez l'historique des modifications de permissions pour chaque co-organisateur. Chaque changement est horodaté et tracé pour assurer la transparence au sein de l'équipe."
      }
    }
  }
}
</i18n>
