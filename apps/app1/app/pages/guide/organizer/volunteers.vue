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
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.dates') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.swaps') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.config.organizers')
            }}</span>
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
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.teams.required') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.teams.accessControl')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.teams.mealValidation')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.teams.visible') }}</span>
          </li>
        </ul>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.teams.special') }}</p>
      </GuideSection>

      <GuideSection icon="i-heroicons-bolt" :title="t('sections.special.title')" color="amber">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.special.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-bolt" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.special.floating.label') }}</strong> —
              {{ t('sections.special.floating.desc') }}</span
            >
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-lock-closed" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.special.autonomous.label') }}</strong> —
              {{ t('sections.special.autonomous.desc') }}</span
            >
          </li>
        </ul>

        <UAlert
          icon="i-heroicons-equals"
          color="neutral"
          variant="subtle"
          :title="t('sections.special.commonTitle')"
          :description="t('sections.special.commonText')"
        />

        <UAlert
          icon="i-heroicons-arrows-right-left"
          color="warning"
          variant="subtle"
          :title="t('sections.special.differenceTitle')"
          :description="t('sections.special.differenceText')"
        />

        <UAlert
          icon="i-heroicons-users"
          color="neutral"
          variant="subtle"
          :title="t('sections.special.doubleTitle')"
          :description="t('sections.special.doubleText')"
        />

        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.special.markers') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-hand-raised"
        :title="t('sections.renforts.title')"
        color="amber"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.renforts.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.renforts.states')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.renforts.nothingToFill')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.renforts.access')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.renforts.assign')
            }}</span>
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

      <GuideSection icon="i-heroicons-eye" :title="t('sections.publication.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.publication.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.publication.closed')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.publication.organizers')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.publication.default')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.publication.floatingException')
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

      <GuideSection
        icon="i-heroicons-arrows-right-left"
        :title="t('sections.swaps.title')"
        color="indigo"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.flow') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.scope') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.effectif') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.toggle') }}</span>
          </li>
        </ul>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.floating') }}</p>
      </GuideSection>

      <GuideSection icon="i-heroicons-chart-bar" :title="t('sections.stats.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.stats.intro') }}</p>
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
              t('sections.stats.volunteersPerDay')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.stats.hoursPerTeam')
            }}</span>
          </li>
        </ul>

        <UAlert
          icon="i-heroicons-scale"
          color="neutral"
          variant="subtle"
          :title="t('sections.stats.coverageTitle')"
          :description="t('sections.stats.coverageText')"
        />

        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.stats.markers') }}</p>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.stats.excluded') }}</p>
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
// Le guide est rédigé en français uniquement : ses libellés ne passent pas par i18n, sinon ils
// s'afficheraient sous forme de clés brutes pour les visiteurs dont l'interface est dans une
// autre langue. Ils sont définis ici et rendus tels quels. Cf. l'encart du layout, qui invite
// les non-francophones à utiliser la traduction intégrée de leur navigateur.
const messages = {
  title: 'Gestion des bénévoles',
  subtitle: 'Organisez votre équipe de bénévoles de A à Z.',
  sections: {
    modes: {
      title: 'Modes de gestion',
      intro: 'Deux modes sont disponibles pour gérer les bénévoles de votre édition :',
      internal: {
        label: 'Mode intégré',
        desc: 'gestion complète directement sur la plateforme : candidatures, équipes, planning, notifications. Recommandé pour une gestion centralisée.',
      },
      external: {
        label: 'Mode externe',
        desc: 'redirection vers une plateforme externe (Google Forms, etc.). Un simple lien est affiché aux visiteurs.',
      },
    },
    config: {
      title: 'Configuration',
      intro: "Paramétrez l'appel à bénévoles depuis la section de configuration :",
      toggle:
        "Activez ou désactivez les candidatures à tout moment. Vous n'avez pas à penser à refermer : les candidatures se ferment d'elles-mêmes une fois le démontage terminé, et la page publique cesse alors d'être visible. Vous et les personnes ayant déjà candidaté gardez accès à tout ce qui a été saisi.",
      page: "Personnalisez la page d'information visible par les bénévoles potentiels (description du bénévolat, avantages, conditions).",
      form: 'Configurez les champs du formulaire de candidature selon vos besoins.',
      dates:
        "Indiquez les dates de montage et de démontage. Elles étendent la période de bénévolat avant et après l'édition, ce sont elles qui donnent leur sens aux phases « Montage » et « Démontage » des repas, et c'est la fin du démontage qui referme le recrutement. À défaut, c'est la date de fin de l'édition qui sert de repère.",
      swaps:
        'Autorisez ou non les échanges de créneaux entre bénévoles. Ouvert par défaut sur les éditions existantes.',
      organizers:
        "Autorisez le rattachement d'organisateurs aux équipes de bénévoles. Ils occupent alors une place sur les créneaux et comptent dans les statistiques, mais restent hors de l'assignation automatique et des échanges.",
    },
    applications: {
      title: 'Gestion des candidatures',
      intro: 'Consultez et traitez les candidatures reçues.',
      table: {
        title: 'Tableau des candidatures',
        filter: 'Filtrez par statut : en attente, acceptée, refusée.',
        stats: 'Consultez les statistiques en temps réel (nombre total, en attente, acceptées).',
        actions: 'Acceptez ou refusez chaque candidature individuellement ou par lot.',
        details:
          "Accédez aux détails complets : informations personnelles, disponibilités, préférences d'équipes, allergies.",
      },
      manual: {
        title: 'Ajout manuel',
        content:
          'Vous pouvez ajouter directement un bénévole sans passer par le formulaire de candidature, utile pour les bénévoles réguliers ou les ajouts de dernière minute.',
      },
    },
    teams: {
      title: 'Gestion des équipes',
      intro: "Créez des équipes pour organiser vos bénévoles par secteur d'activité.",
      create:
        "Créez autant d'équipes que nécessaire (accueil, bar, technique, sécurité, cuisine, etc.).",
      color: 'Attribuez une couleur à chaque équipe pour un repérage visuel rapide.',
      maxVolunteers:
        "Indiquez un effectif souhaité pour l'équipe. C'est un repère de dimensionnement, affiché dans les statistiques : rien n'empêche d'y rattacher davantage de monde. Le nombre maximum d'un créneau, lui, est un vrai plafond.",
      leader:
        "Désignez des responsables d'équipe (team leaders) qui pourront envoyer des notifications à leur équipe.",
      required:
        'Rendez une équipe obligatoire : les bénévoles devront la sélectionner dans leurs préférences.',
      accessControl:
        "Marquez l'équipe qui s'occupe du contrôle d'accès : ses membres pourront valider les entrées des participants.",
      mealValidation:
        "Marquez de même l'équipe qui valide les repas. C'est ce réglage, et non un droit d'organisateur, qui ouvre l'écran de validation à des bénévoles.",
      visible:
        "Masquez une équipe aux bénévoles si elle ne les concerne pas — elle disparaît de leurs préférences et du planning qu'ils consultent, sans rien changer pour l'organisation.",
      special:
        'Deux réglages supplémentaires changent la nature même de l’équipe — volante et autonome — et font l’objet de la section suivante.',
    },
    special: {
      title: 'Équipes volantes et équipes autonomes',
      intro:
        "Deux réglages sortent une équipe du fonctionnement ordinaire. Ils se ressemblent beaucoup vus de l'équipe, et font exactement l'inverse vus des personnes — mieux vaut ne pas les confondre.",
      floating: {
        label: 'Équipe de bénévoles volants',
        desc: "des gens à disposition, sans créneau fixe, qu'on appelle quand une équipe prend du retard. Ils ne sont pas tenus au volume d'heures demandé aux autres, et l'assignation automatique ne leur donne rien.",
      },
      autonomous: {
        label: 'Équipe autonome',
        desc: "une équipe qui s'organise elle-même, en dehors de l'outil. Ses créneaux ne sont pas remplis automatiquement, et ses membres lui sont réservés : l'assignation automatique ne les envoie nulle part ailleurs.",
      },
      commonTitle: 'Ce que les deux partagent',
      commonText:
        "Dans les deux cas, les créneaux de l'équipe sortent des « heures à pourvoir » de l'édition : personne d'autre ne viendra les couvrir, et les compter ferait paraître l'édition sous-dotée alors qu'il ne manque rien. Les heures réellement tenues, elles, restent affichées sur la ligne de l'équipe.",
      differenceTitle: 'Ce qui les oppose',
      differenceText:
        "La volante LIBÈRE ses membres : dispensés de leur volume d'heures, ils sont proposés en renfort sur les créneaux des autres équipes. L'autonome les RÉSERVE : ils restent tenus à leurs heures, et ne sont proposés en renfort nulle part. Un réglage pour prêter des gens, l'autre pour les garder.",
      doubleTitle: 'La double appartenance annule les deux',
      doubleText:
        "Un bénévole n'est volant que si TOUTES ses équipes sont volantes, et réservé que si toutes sont autonomes. Quelqu'un qui est à la fois en cuisine et volant reste un bénévole ordinaire : rattacher quelqu'un à une seconde équipe, c'est avoir décidé de le partager.",
      markers:
        'Une icône signale les deux partout où la décision se prend : première colonne du planning, relevés d’heures, répartition par équipes.',
    },
    renforts: {
      title: 'Trouver un renfort maintenant',
      intro:
        'La page « Renforts » répond à la question du samedi 18 h, quand une équipe déborde : non pas qui est volant, mais qui est volant, SUR PLACE, et LIBRE tout de suite.',
      states:
        'Trois états, et non deux : disponible, sur un créneau (avec l’heure à laquelle il se libère), ou pas encore arrivé. Celui qui tient un poste se libérera ; celui qui n’est pas là ne se libérera peut-être jamais.',
      nothingToFill:
        "Rien n'est demandé à personne pour alimenter cette page : la validation d'entrée dit qui est arrivé, les créneaux disent qui est occupé. L'heure avance toute seule, la liste se réordonne sans rechargement.",
      access:
        "Elle est ouverte aux responsables d'équipe autant qu'aux gestionnaires : c'est le responsable débordé qui cherche du renfort.",
      assign:
        "Pour placer un volant sur un créneau, ouvrez-le depuis le planning : la fenêtre d'affectation propose d'abord les membres de l'équipe, puis les « renforts disponibles » à part.",
    },
    publication: {
      title: 'Publier le planning',
      intro:
        "L'interrupteur « Publier le planning aux bénévoles », en tête de la page de planification, décide si les bénévoles voient leurs créneaux.",
      closed:
        'Tant qu’il est éteint, ni les créneaux ni le planning de l’édition ne leur sont montrés. Vous pouvez placer une équipe, vous raviser et déplacer un créneau sans que personne ne note des horaires qui n’existeront plus le lendemain.',
      organizers:
        "L'équipe d'organisation, elle, voit toujours tout : l'interrupteur ne masque rien côté gestion.",
      default:
        'Une édition nouvellement créée démarre planning masqué. Les éditions existantes, elles, sont restées publiées — personne n’a perdu un accès qu’il avait déjà.',
      floatingException:
        "Un bénévole volant apprend son rôle même planning masqué : il attendrait sinon des créneaux qui ne viendront jamais. Ses équipes, elles, restent cachées jusqu'à publication.",
    },
    swaps: {
      title: 'Échanges de créneaux',
      intro:
        'Les bénévoles peuvent échanger un créneau entre eux, sans repasser par vous pour chaque ajustement.',
      flow: 'Le circuit se fait en trois temps : un bénévole propose un de ses créneaux, un autre accepte, puis un organisateur valide. Rien ne bouge au planning avant cette validation.',
      scope:
        'Un bénévole ne voit que les créneaux de ses propres équipes, et ceux qui chevaucheraient l’un des siens ne lui sont pas proposés.',
      effectif:
        "Au moment de valider, l'écran montre l'effectif du créneau APRÈS l'échange, et signale les personnes que le bénévole avait demandé à éviter.",
      toggle:
        'Le réglage « Échanges de créneaux » de la configuration ferme le mécanisme pour toute l’édition.',
      floating:
        "Les bénévoles volants en sont entièrement exclus, dans les deux sens : ils ne proposent pas les créneaux qu'on leur a confiés en renfort, et personne ne peut les leur demander. L'échange est un mécanisme entre gens qui se doivent un volume d'heures ; un volant n'en doit aucun.",
    },
    assignment: {
      title: 'Répartition par équipes',
      intro: 'Assignez les bénévoles acceptés à leurs équipes.',
      dragDrop:
        'Glissez-déposez les bénévoles entre les équipes sur ordinateur, ou utilisez le menu de sélection sur mobile.',
      multiTeam:
        'Un bénévole peut être assigné à plusieurs équipes. Choisissez « Ajouter » pour conserver les équipes existantes ou « Déplacer » pour remplacer.',
      indicators:
        'Les indicateurs visuels montrent le taux de remplissage de chaque équipe et si les préférences du bénévole sont respectées.',
      stats:
        "Consultez les statistiques d'assignation : bénévoles assignés, non assignés, total d'assignations.",
    },
    planning: {
      title: 'Planning interactif',
      intro: 'Gérez le planning des bénévoles via un calendrier interactif FullCalendar.',
      slots: {
        title: 'Créneaux horaires',
        create:
          "Cliquez sur le calendrier pour créer un nouveau créneau. Définissez l'heure de début, de fin et la durée.",
        team: 'Associez chaque créneau à une équipe pour organiser les rotations.',
        maxVolunteers: 'Limitez le nombre de bénévoles par créneau selon vos besoins.',
        description:
          'Ajoutez une description pour préciser les tâches à effectuer pendant le créneau.',
      },
      auto: {
        title: 'Auto-assignation intelligente',
        content:
          "L'algorithme d'auto-assignation répartit automatiquement les bénévoles sur les créneaux en tenant compte de :",
        preferences: "Les préférences d'équipes indiquées par chaque bénévole.",
        availability: 'Les disponibilités déclarées dans la candidature.',
        meals: "Les périodes de repas (évite d'assigner pendant le déjeuner ou le dîner).",
        balance: "L'équilibre des heures entre bénévoles pour une répartition équitable.",
      },
    },
    conflicts: {
      title: 'Détection de conflits',
      intro: 'Le système détecte automatiquement les problèmes potentiels :',
      overlap: 'Chevauchements : un bénévole assigné à deux créneaux qui se superposent.',
      preferences:
        "Préférences non respectées : un bénévole assigné à une équipe qu'il n'avait pas choisie.",
      meals:
        'Conflits repas : un créneau couvrant entièrement une période de repas (11h30-14h ou 19h30-22h).',
    },
    stats: {
      title: 'Statistiques',
      intro:
        "Le relevé se lit sous quatre angles, et l'un d'eux mérite une explication : les heures par équipe.",
      hoursPerVolunteer: 'Heures totales et nombre de créneaux, bénévole par bénévole.',
      volunteersPerDay: 'Nombre de bénévoles actifs et heures de bénévolat, jour par jour.',
      hoursPerTeam:
        'Heures par équipe, au total et jour par jour, avec le nombre de personnes réellement affectées.',
      coverageTitle: 'Heures à pourvoir et heures tenues',
      coverageText:
        "Les heures À POURVOIR sont la durée d'un créneau multipliée par le nombre de places qu'il demande, et non par le nombre de personnes déjà placées. Un créneau de deux heures demandant trois bénévoles pèse donc six heures dès sa création, avant toute affectation : c'est cette charge qui permet de dimensionner une équipe, et elle ne doit pas grandir au fil des affectations. Les heures TENUES, affichées à côté, disent où en est le remplissage.",
      markers:
        'Des repères accompagnent les noms : organisateur, volant, réservé. Ils expliquent pourquoi un total est plus bas que les autres — sans eux, on lirait un oubli d’affectation là où il n’y en a pas.',
      excluded:
        "Les créneaux des équipes volantes et autonomes figurent avec zéro heure à pourvoir et leurs heures réellement tenues : des gens y ont travaillé, mais personne d'autre ne viendra les couvrir.",
    },
    notifications: {
      title: 'Notifications',
      intro: 'Communiquez efficacement avec vos bénévoles.',
      sendSlots:
        'Envoyez le récapitulatif des créneaux à tous les bénévoles acceptés (e-mail + notification push).',
      custom:
        "Créez des notifications personnalisées pour informer d'un changement ou rappeler une consigne.",
      groups:
        "Ciblez vos notifications par groupe : tous les bénévoles, une équipe spécifique, ou les responsables d'équipe.",
      confirmation:
        'Les bénévoles peuvent confirmer la lecture de vos messages pour que vous sachiez qui est informé.',
      teamLeaders:
        "Les responsables d'équipe peuvent également envoyer des notifications à leur propre équipe.",
    },
  },
}

const t = (path: string): string =>
  path.split('.').reduce<any>((value, key) => value?.[key], messages) ?? path

definePageMeta({ layout: 'guide', title: 'Guide - Gestion des bénévoles' })

useHead({
  title: 'Guide Bénévoles | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide organisateur : gestion complète des bénévoles, équipes volantes et autonomes, planning interactif, publication, échanges de créneaux, renforts et notifications.',
    },
  ],
})
</script>
