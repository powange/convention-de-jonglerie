<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-academic-cap"
        :title="t('sections.workshops.title')"
        color="indigo"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.workshops.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.workshops.create')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.workshops.info') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.workshops.instructor')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.workshops.registration')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-magnifying-glass-circle"
        :title="t('sections.lostFound.title')"
        color="amber"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.lostFound.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.lostFound.activate')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.lostFound.report')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.lostFound.list') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.lostFound.recover')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-newspaper"
        :title="t('sections.publications.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.publications.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.publications.create')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.publications.content')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.publications.visibility')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-truck" :title="t('sections.carpooling.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.carpooling.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.carpooling.feature')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.carpooling.moderation')
            }}</span>
          </li>
        </ul>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({ layout: 'guide', title: 'Guide - Autres fonctionnalités' })

useHead({
  title: 'Guide Autres fonctionnalités | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content: 'Guide organisateur : workshops, objets trouvés, publications et covoiturage.',
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Autres fonctionnalités",
    "subtitle": "Workshops, objets trouvés, publications et covoiturage.",
    "sections": {
      "workshops": {
        "title": "Workshops",
        "intro": "Organisez des ateliers et workshops pendant votre édition.",
        "create": "Créez un workshop avec un titre, une description, une date et un lieu.",
        "info": "Précisez le niveau requis, le matériel nécessaire et le nombre de places disponibles.",
        "instructor": "Associez un animateur (utilisateur de la plateforme ou nom libre).",
        "registration": "Les participants peuvent s'inscrire directement depuis la page de l'édition."
      },
      "lostFound": {
        "title": "Objets trouvés",
        "intro": "Activez le système d'objets trouvés pendant votre édition.",
        "activate": "Le module est disponible uniquement pendant la durée de l'édition.",
        "report": "Les participants et bénévoles peuvent signaler un objet trouvé avec photo et description.",
        "list": "Consultez la liste de tous les objets signalés depuis le tableau de bord.",
        "recover": "Marquez un objet comme récupéré lorsque son propriétaire le réclame."
      },
      "publications": {
        "title": "Publications",
        "intro": "Publiez des actualités sur le fil d'activité de votre édition.",
        "create": "Créez des publications pour informer les participants des nouveautés, changements ou rappels.",
        "content": "Ajoutez du texte, des images et des liens à vos publications.",
        "visibility": "Les publications sont visibles par tous les visiteurs de la page de l'édition."
      },
      "carpooling": {
        "title": "Covoiturage",
        "intro": "Facilitez l'accès à votre événement grâce au covoiturage.",
        "feature": "Les participants peuvent proposer ou rechercher des trajets de covoiturage vers votre édition.",
        "moderation": "En tant qu'organisateur, vous pouvez modérer les annonces de covoiturage si nécessaire."
      }
    }
  }
}
</i18n>
