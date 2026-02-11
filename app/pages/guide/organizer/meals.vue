<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection icon="i-heroicons-cog-6-tooth" :title="t('sections.config.title')" color="orange">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.config.intro') }}</p>
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">{{ t('sections.config.types.title') }}</h3>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.types.breakfast') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.types.lunch') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.types.dinner') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.types.snack') }}</span>
          </li>
        </ul>
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">{{ t('sections.config.phases.title') }}</h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.config.phases.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.config.phases.setup.label') }}</strong> — {{ t('sections.config.phases.setup.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.config.phases.event.label') }}</strong> — {{ t('sections.config.phases.event.desc') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"><strong>{{ t('sections.config.phases.teardown.label') }}</strong> — {{ t('sections.config.phases.teardown.desc') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-arrow-path" :title="t('sections.sync.title')" color="orange">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.sync.content') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.sync.volunteers') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.sync.artists') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.sync.automatic') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-tag" :title="t('sections.items.title')" color="orange">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.items.content') }}</p>
      </GuideSection>

      <GuideSection icon="i-heroicons-table-cells" :title="t('sections.list.title')" color="orange">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.list.content') }}</p>
      </GuideSection>

      <GuideSection icon="i-heroicons-qr-code" :title="t('sections.validate.title')" color="orange">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.validate.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.validate.scan') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.validate.search') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.validate.history') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.validate.access') }}</span>
          </li>
        </ul>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({ layout: 'guide', title: 'Guide - Gestion des repas' })

useHead({
  title: 'Guide Repas | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide organisateur : configurer les repas, synchroniser avec bénévoles et artistes, valider sur place.',
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Gestion des repas",
    "subtitle": "Configurez et gérez les repas pour vos bénévoles et artistes.",
    "sections": {
      "config": {
        "title": "Configuration des repas",
        "intro": "Définissez les repas disponibles pour chaque jour de votre édition.",
        "types": {
          "title": "Types de repas",
          "breakfast": "Petit-déjeuner",
          "lunch": "Déjeuner",
          "dinner": "Dîner",
          "snack": "Collation / Goûter"
        },
        "phases": {
          "title": "Phases d'activation",
          "intro": "Chaque repas peut être activé pour une ou plusieurs phases de l'événement :",
          "setup": {
            "label": "Montage",
            "desc": "pour les bénévoles présents avant le début officiel de l'édition."
          },
          "event": {
            "label": "Événement",
            "desc": "pendant la durée de l'édition."
          },
          "teardown": {
            "label": "Démontage",
            "desc": "pour les bénévoles restant après la fin de l'édition."
          }
        }
      },
      "sync": {
        "title": "Synchronisation automatique",
        "content": "Les repas configurés sont automatiquement synchronisés avec les différents acteurs de votre édition :",
        "volunteers": "Repas bénévoles : chaque bénévole accepté se voit attribuer les repas correspondant à ses créneaux.",
        "artists": "Repas artistes : les artistes programmés bénéficient des repas configurés.",
        "automatic": "La synchronisation est automatique : toute modification de la configuration des repas est immédiatement répercutée."
      },
      "items": {
        "title": "Articles de repas",
        "content": "Associez des articles à restituer aux repas (ex : tickets repas, bracelets). Ces articles permettent de contrôler l'accès aux repas et de suivre leur distribution."
      },
      "list": {
        "title": "Liste récapitulative",
        "content": "La page de liste offre une vue d'ensemble de tous les repas avec le nombre de personnes attendues par repas et par jour, facilitant la planification logistique."
      },
      "validate": {
        "title": "Validation sur place",
        "intro": "Pendant l'événement, validez les repas en temps réel.",
        "scan": "Scannez le QR code du bénévole ou de l'artiste pour valider son repas.",
        "search": "Recherchez un participant par nom si le scan n'est pas possible.",
        "history": "Consultez l'historique des validations pour éviter les doublons.",
        "access": "Les bénévoles d'équipes de validation ont accès à cette fonctionnalité."
      }
    }
  }
}
</i18n>
