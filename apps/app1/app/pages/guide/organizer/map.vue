<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection icon="i-heroicons-globe-alt" :title="t('sections.publish.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.publish.content') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-square-3-stack-3d"
        :title="t('sections.zones.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.zones.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.zones.draw') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.zones.name') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.zones.color') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.zones.examples') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.zones.edit') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-map-pin" :title="t('sections.markers.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.markers.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.markers.place') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.markers.icon') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.markers.color') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.markers.label') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.markers.dragDrop')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-list-bullet"
        :title="t('sections.legend.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.legend.content') }}</p>
      </GuideSection>

      <GuideSection icon="i-heroicons-link" :title="t('sections.shows.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.shows.content') }}</p>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({ layout: 'guide', title: 'Guide - Carte interactive' })

useHead({
  title: 'Guide Carte interactive | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide organisateur : carte interactive, zones, marqueurs et plan du site pour votre convention.',
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Carte interactive",
    "subtitle": "Créez le plan de votre site avec zones et points d'intérêt.",
    "sections": {
      "publish": {
        "title": "Publication de la carte",
        "content": "Activez la carte interactive pour la rendre visible aux visiteurs de votre édition. Tant que la carte n'est pas publiée, seuls les organisateurs y ont accès pour la préparer."
      },
      "zones": {
        "title": "Zones",
        "intro": "Les zones sont des surfaces colorées sur la carte qui délimitent les différentes aires de votre site.",
        "draw": "Dessinez des polygones directement sur la carte en cliquant pour placer chaque sommet.",
        "name": "Donnez un nom descriptif à chaque zone.",
        "color": "Attribuez une couleur distincte pour un repérage visuel immédiat.",
        "examples": "Exemples de zones : parking, camping, scène principale, chapiteau, espace restauration, zone de jeu.",
        "edit": "Modifiez les contours d'une zone en déplaçant ses sommets, ou supprimez-la."
      },
      "markers": {
        "title": "Marqueurs",
        "intro": "Les marqueurs sont des points d'intérêt précis sur la carte.",
        "place": "Cliquez sur la carte pour placer un marqueur à l'emplacement souhaité.",
        "icon": "Choisissez une icône représentative (toilettes, bar, info, premiers secours, scène, etc.).",
        "color": "Attribuez une couleur au marqueur pour le distinguer des autres.",
        "label": "Ajoutez un libellé qui s'affiche au survol ou au clic.",
        "dragDrop": "Repositionnez les marqueurs par glisser-déposer."
      },
      "legend": {
        "title": "Légende interactive",
        "content": "La carte génère automatiquement une légende basée sur vos zones et marqueurs. Les visiteurs peuvent cliquer sur un élément de la légende pour le mettre en évidence sur la carte."
      },
      "shows": {
        "title": "Association avec les spectacles",
        "content": "Associez vos spectacles à des zones ou des marqueurs de la carte. Les visiteurs pourront ainsi localiser facilement où se déroulent les spectacles depuis le programme."
      }
    }
  }
}
</i18n>
