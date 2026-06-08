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
        color="amber"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.groups.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.groups.create') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.groups.examples')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.groups.reorder') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-cube" :title="t('sections.items.title')" color="amber">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.items.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.items.fields') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.items.quantity') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.items.location') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-arrow-path-rounded-square"
        :title="t('sections.externalLoan.title')"
        color="amber"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.externalLoan.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.externalLoan.owner')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.externalLoan.returnDue')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.externalLoan.overdue')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-calendar-days"
        :title="t('sections.reservations.title')"
        color="amber"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.reservations.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.reservations.period')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.reservations.usage')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.reservations.status')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.reservations.bulk')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-chart-bar-square"
        :title="t('sections.planning.title')"
        color="amber"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.planning.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.availability')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.planning.view') }}</span>
          </li>
        </ul>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({ layout: 'guide', title: 'Guide - Gestion du matériel' })

useHead({
  title: 'Guide Gestion du matériel | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide organisateur : gérez le matériel de votre édition avec des groupes, un inventaire, les prêts externes et les réservations sur des périodes.',
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Gestion du matériel",
    "subtitle": "Inventoriez le matériel de votre édition et gérez ses réservations dans le temps.",
    "sections": {
      "groups": {
        "title": "Groupes de matériel",
        "intro": "Le matériel est organisé en groupes pour structurer votre inventaire.",
        "create": "Créez autant de groupes que nécessaire, avec un nom et une description optionnelle.",
        "examples": "Organisez par type de matériel (son, lumière, feu, structures, mobilier…) ou par lieu de stockage.",
        "reorder": "Réordonnez les groupes par glisser-déposer pour les présenter dans l'ordre qui vous convient."
      },
      "items": {
        "title": "Articles de matériel",
        "intro": "Ajoutez les articles dans chaque groupe pour constituer votre inventaire.",
        "fields": "Chaque article possède un nom, une description et des notes optionnelles.",
        "quantity": "Indiquez la quantité d'exemplaires identiques disponibles pour cet article.",
        "location": "Définissez l'emplacement de rangement : texte libre, zone ou marqueur de la carte interactive."
      },
      "externalLoan": {
        "title": "Prêt externe",
        "intro": "Suivez le matériel prêté par une personne extérieure à la convention.",
        "owner": "Marquez un article comme prêt externe et renseignez le contact du propriétaire.",
        "returnDue": "Indiquez la date prévue de retour au propriétaire, puis marquez l'article comme rendu une fois restitué.",
        "overdue": "Les prêts non rendus dont la date de retour est dépassée sont signalés comme en retard."
      },
      "reservations": {
        "title": "Réservations",
        "intro": "Réservez du matériel sur des périodes précises pour éviter les conflits d'utilisation.",
        "period": "Réservez une quantité d'un article sur une période (début et fin), avec un lieu d'utilisation (texte, zone ou marqueur).",
        "usage": "Précisez l'usage de la réservation (ex : « Spectacle de feu samedi 22h »).",
        "status": "Suivez l'état de chaque réservation : Réservé, Sorti, Rendu ou Annulé.",
        "bulk": "Réservez plusieurs articles en une seule fois grâce à la réservation en masse."
      },
      "planning": {
        "title": "Disponibilité & planning",
        "intro": "Gardez une vue d'ensemble de l'utilisation de votre matériel.",
        "availability": "La disponibilité tient compte des réservations existantes pour éviter de réserver plus d'exemplaires que disponibles.",
        "view": "Le planning d'un groupe affiche les réservations dans le temps pour repérer les périodes chargées."
      }
    }
  }
}
</i18n>
