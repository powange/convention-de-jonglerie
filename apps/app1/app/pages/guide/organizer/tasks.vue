<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-rectangle-stack"
        :title="t('sections.groups.title')"
        color="indigo"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.groups.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.groups.create') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.groups.examples')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.groups.reorder') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-clipboard-document-list"
        :title="t('sections.tasks.title')"
        color="indigo"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.tasks.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tasks.fields') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tasks.status') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tasks.deadline') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-view-columns"
        :title="t('sections.organize.title')"
        color="indigo"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.organize.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.organize.kanban')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.organize.dragdrop')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.organize.filters')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-user-plus" :title="t('sections.assign.title')" color="indigo">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.assign.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.assign.who') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.assign.multiple')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.assign.permission')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-tag" :title="t('sections.tags.title')" color="indigo">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.tags.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tags.create') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tags.assign') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-check-circle"
        :title="t('sections.checklists.title')"
        color="indigo"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.checklists.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.checklists.add') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.checklists.check')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-chat-bubble-left-right"
        :title="t('sections.comments.title')"
        color="indigo"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.comments.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.comments.discuss')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.comments.edit') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-user-circle"
        :title="t('sections.myTasks.title')"
        color="indigo"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.myTasks.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.myTasks.view') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.myTasks.update') }}</span>
          </li>
        </ul>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({ layout: 'guide', title: 'Guide - Gestion des tâches' })

useHead({
  title: 'Guide Gestion des tâches | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide organisateur : organisez le travail de votre équipe avec des groupes de tâches, assignations, étiquettes, checklists et commentaires.',
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Gestion des tâches",
    "subtitle": "Organisez le travail de votre équipe pour préparer et suivre votre édition.",
    "sections": {
      "groups": {
        "title": "Groupes de tâches",
        "intro": "Les tâches sont organisées en groupes pour structurer le travail selon vos besoins.",
        "create": "Créez autant de groupes que nécessaire, avec un nom et une description optionnelle.",
        "examples": "Organisez les groupes par phase (avant / pendant / après), par équipe ou par thème (logistique, communication, technique…).",
        "reorder": "Réordonnez les groupes par glisser-déposer pour les présenter dans l'ordre qui vous convient."
      },
      "tasks": {
        "title": "Créer et suivre les tâches",
        "intro": "Ajoutez des tâches dans chaque groupe et suivez leur avancement.",
        "fields": "Chaque tâche possède un titre et une description détaillée optionnelle.",
        "status": "Suivez l'état d'une tâche : À faire, En cours, Terminée ou Annulée.",
        "deadline": "Fixez une date d'échéance optionnelle pour ne rien oublier."
      },
      "organize": {
        "title": "Organisation visuelle",
        "intro": "Visualisez et organisez les tâches d'un groupe d'un coup d'œil.",
        "kanban": "Affichage en colonnes (tableau kanban) regroupant les tâches par statut.",
        "dragdrop": "Déplacez les tâches par glisser-déposer pour changer leur statut ou les réordonner.",
        "filters": "Filtrez les tâches par statut, par personne assignée ou par étiquette."
      },
      "assign": {
        "title": "Assignation",
        "intro": "Répartissez le travail en assignant les tâches aux membres de votre équipe.",
        "who": "Assignez les tâches aux co-organisateurs et aux bénévoles acceptés de l'édition.",
        "multiple": "Une tâche peut être assignée à plusieurs personnes simultanément.",
        "permission": "La gestion des tâches nécessite la permission « Gérer les tâches »."
      },
      "tags": {
        "title": "Étiquettes",
        "intro": "Catégorisez finement les tâches au sein d'un groupe grâce aux étiquettes.",
        "create": "Créez des étiquettes colorées propres à chaque groupe (ex : « urgent », « matériel », « à valider »).",
        "assign": "Attribuez une ou plusieurs étiquettes à chaque tâche pour la retrouver facilement."
      },
      "checklists": {
        "title": "Checklists",
        "intro": "Découpez une tâche complexe en sous-étapes cochables sans créer de nouvelles tâches.",
        "add": "Ajoutez des éléments de checklist à une tâche pour lister les étapes à réaliser.",
        "check": "Cochez les éléments au fur et à mesure pour suivre la progression de la tâche."
      },
      "comments": {
        "title": "Commentaires",
        "intro": "Échangez avec votre équipe directement sur chaque tâche.",
        "discuss": "Ajoutez des commentaires pour discuter, partager des informations ou poser des questions.",
        "edit": "Modifiez ou supprimez vos propres commentaires à tout moment."
      },
      "myTasks": {
        "title": "Mes tâches",
        "intro": "Chaque membre retrouve facilement le travail qui lui est confié.",
        "view": "La page « Mes tâches » regroupe toutes les tâches assignées à la personne connectée sur l'édition.",
        "update": "Chacun peut suivre et mettre à jour l'avancement des tâches qui le concernent."
      }
    }
  }
}
</i18n>
