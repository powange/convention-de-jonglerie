<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-adjustments-horizontal"
        :title="t('sections.modes.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.modes.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.modes.internal.label') }}</strong> —
              {{ t('sections.modes.internal.desc') }}</span
            >
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.modes.external.label') }}</strong> —
              {{ t('sections.modes.external.desc') }}</span
            >
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-cog-6-tooth"
        :title="t('sections.config.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.config.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.toggle') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.page') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.form') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-inbox-stack"
        :title="t('sections.applications.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.applications.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.applications.table.title') }}
        </h3>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.applications.table.filter')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.applications.table.stats')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.applications.table.actions')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.applications.table.details')
            }}</span>
          </li>
        </ul>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.applications.manual.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('sections.applications.manual.content') }}
        </p>
      </GuideSection>

      <GuideSection icon="i-heroicons-user-group" :title="t('sections.teams.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.teams.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.teams.create') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.teams.color') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.teams.maxVolunteers')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.teams.leader') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-arrows-right-left"
        :title="t('sections.assignment.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.assignment.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.assignment.dragDrop')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.assignment.multiTeam')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.assignment.indicators')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.assignment.stats')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-calendar-days"
        :title="t('sections.planning.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.planning.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.planning.slots.title') }}
        </h3>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.slots.create')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.slots.team')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.slots.maxVolunteers')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.slots.description')
            }}</span>
          </li>
        </ul>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.planning.auto.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.planning.auto.content') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.auto.preferences')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.auto.availability')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.auto.meals')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.auto.balance')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-exclamation-triangle"
        :title="t('sections.conflicts.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.conflicts.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.conflicts.overlap')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.conflicts.preferences')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.conflicts.meals')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-chart-bar" :title="t('sections.stats.title')" color="green">
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.stats.hoursPerVolunteer')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.stats.slotsPerVolunteer')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.stats.volunteersPerDay')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.stats.hoursPerDay')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-bell"
        :title="t('sections.notifications.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.notifications.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.notifications.sendSlots')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.notifications.custom')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.notifications.groups')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.notifications.confirmation')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.notifications.teamLeaders')
            }}</span>
          </li>
        </ul>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({ layout: 'guide', title: 'Guide - Gestion des bénévoles' })

useHead({
  title: 'Guide Bénévoles | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide organisateur : gestion complète des bénévoles, équipes, planning interactif, auto-assignation et notifications.',
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Gestion des bénévoles",
    "subtitle": "Organisez votre équipe de bénévoles de A à Z.",
    "sections": {
      "modes": {
        "title": "Modes de gestion",
        "intro": "Deux modes sont disponibles pour gérer les bénévoles de votre édition :",
        "internal": {
          "label": "Mode intégré",
          "desc": "gestion complète directement sur la plateforme : candidatures, équipes, planning, notifications. Recommandé pour une gestion centralisée."
        },
        "external": {
          "label": "Mode externe",
          "desc": "redirection vers une plateforme externe (Google Forms, etc.). Un simple lien est affiché aux visiteurs."
        }
      },
      "config": {
        "title": "Configuration",
        "intro": "Paramétrez l'appel à bénévoles depuis la section de configuration :",
        "toggle": "Activez ou désactivez les candidatures à tout moment.",
        "page": "Personnalisez la page d'information visible par les bénévoles potentiels (description du bénévolat, avantages, conditions).",
        "form": "Configurez les champs du formulaire de candidature selon vos besoins."
      },
      "applications": {
        "title": "Gestion des candidatures",
        "intro": "Consultez et traitez les candidatures reçues.",
        "table": {
          "title": "Tableau des candidatures",
          "filter": "Filtrez par statut : en attente, acceptée, refusée.",
          "stats": "Consultez les statistiques en temps réel (nombre total, en attente, acceptées).",
          "actions": "Acceptez ou refusez chaque candidature individuellement ou par lot.",
          "details": "Accédez aux détails complets : informations personnelles, disponibilités, préférences d'équipes, allergies."
        },
        "manual": {
          "title": "Ajout manuel",
          "content": "Vous pouvez ajouter directement un bénévole sans passer par le formulaire de candidature, utile pour les bénévoles réguliers ou les ajouts de dernière minute."
        }
      },
      "teams": {
        "title": "Gestion des équipes",
        "intro": "Créez des équipes pour organiser vos bénévoles par secteur d'activité.",
        "create": "Créez autant d'équipes que nécessaire (accueil, bar, technique, sécurité, cuisine, etc.).",
        "color": "Attribuez une couleur à chaque équipe pour un repérage visuel rapide.",
        "maxVolunteers": "Définissez un nombre maximum de bénévoles par équipe.",
        "leader": "Désignez des responsables d'équipe (team leaders) qui pourront envoyer des notifications à leur équipe."
      },
      "assignment": {
        "title": "Répartition par équipes",
        "intro": "Assignez les bénévoles acceptés à leurs équipes.",
        "dragDrop": "Glissez-déposez les bénévoles entre les équipes sur ordinateur, ou utilisez le menu de sélection sur mobile.",
        "multiTeam": "Un bénévole peut être assigné à plusieurs équipes. Choisissez « Ajouter » pour conserver les équipes existantes ou « Déplacer » pour remplacer.",
        "indicators": "Les indicateurs visuels montrent le taux de remplissage de chaque équipe et si les préférences du bénévole sont respectées.",
        "stats": "Consultez les statistiques d'assignation : bénévoles assignés, non assignés, total d'assignations."
      },
      "planning": {
        "title": "Planning interactif",
        "intro": "Gérez le planning des bénévoles via un calendrier interactif FullCalendar.",
        "slots": {
          "title": "Créneaux horaires",
          "create": "Cliquez sur le calendrier pour créer un nouveau créneau. Définissez l'heure de début, de fin et la durée.",
          "team": "Associez chaque créneau à une équipe pour organiser les rotations.",
          "maxVolunteers": "Limitez le nombre de bénévoles par créneau selon vos besoins.",
          "description": "Ajoutez une description pour préciser les tâches à effectuer pendant le créneau."
        },
        "auto": {
          "title": "Auto-assignation intelligente",
          "content": "L'algorithme d'auto-assignation répartit automatiquement les bénévoles sur les créneaux en tenant compte de :",
          "preferences": "Les préférences d'équipes indiquées par chaque bénévole.",
          "availability": "Les disponibilités déclarées dans la candidature.",
          "meals": "Les périodes de repas (évite d'assigner pendant le déjeuner ou le dîner).",
          "balance": "L'équilibre des heures entre bénévoles pour une répartition équitable."
        }
      },
      "conflicts": {
        "title": "Détection de conflits",
        "intro": "Le système détecte automatiquement les problèmes potentiels :",
        "overlap": "Chevauchements : un bénévole assigné à deux créneaux qui se superposent.",
        "preferences": "Préférences non respectées : un bénévole assigné à une équipe qu'il n'avait pas choisie.",
        "meals": "Conflits repas : un créneau couvrant entièrement une période de repas (11h30-14h ou 19h30-22h)."
      },
      "stats": {
        "title": "Statistiques",
        "hoursPerVolunteer": "Heures totales par bénévole.",
        "slotsPerVolunteer": "Nombre de créneaux par bénévole.",
        "volunteersPerDay": "Nombre de bénévoles actifs par jour.",
        "hoursPerDay": "Heures totales de bénévolat par jour."
      },
      "notifications": {
        "title": "Notifications",
        "intro": "Communiquez efficacement avec vos bénévoles.",
        "sendSlots": "Envoyez le récapitulatif des créneaux à tous les bénévoles acceptés (e-mail + notification push).",
        "custom": "Créez des notifications personnalisées pour informer d'un changement ou rappeler une consigne.",
        "groups": "Ciblez vos notifications par groupe : tous les bénévoles, une équipe spécifique, ou les responsables d'équipe.",
        "confirmation": "Les bénévoles peuvent confirmer la lecture de vos messages pour que vous sachiez qui est informé.",
        "teamLeaders": "Les responsables d'équipe peuvent également envoyer des notifications à leur propre équipe."
      }
    }
  }
}
</i18n>
