<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection icon="i-heroicons-cog-6-tooth" :title="t('sections.config.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.config.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.onSite') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.config.anonymous') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-arrow-top-right-on-square" :title="t('sections.external.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.external.content') }}</p>
      </GuideSection>

      <GuideSection icon="i-heroicons-currency-euro" :title="t('sections.tiers.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.tiers.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tiers.create') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tiers.price') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tiers.quota') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tiers.options') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tiers.items') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-shopping-cart" :title="t('sections.orders.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.orders.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.orders.list') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.orders.details') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.orders.status') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-qr-code" :title="t('sections.access.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.access.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.access.scan') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.access.manual') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.access.validation') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-building-storefront" :title="t('sections.counter.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.counter.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.counter.create') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.counter.sell') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.counter.cash') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-chart-bar" :title="t('sections.stats.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.stats.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.stats.sales') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.stats.revenue') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.stats.attendance') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.stats.tiers') }}</span>
          </li>
        </ul>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({ layout: 'guide', title: 'Guide - Billetterie' })

useHead({
  title: 'Guide Billetterie | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        "Guide organisateur : billetterie intégrée, tarifs, commandes, contrôle d'accès par QR code et statistiques.",
    },
  ],
})
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Billetterie",
    "subtitle": "Gérez les inscriptions, les tarifs et le contrôle d'accès.",
    "sections": {
      "config": {
        "title": "Configuration générale",
        "intro": "Paramétrez les options de base de votre billetterie.",
        "onSite": "Inscription sur place : autorisez ou non l'ajout manuel de participants le jour de l'événement.",
        "anonymous": "Commandes anonymes : permettez aux visiteurs de s'inscrire sans créer de compte sur la plateforme."
      },
      "external": {
        "title": "Billetterie externe",
        "content": "Si vous utilisez déjà une plateforme de billetterie (HelloAsso, Billetweb, etc.), configurez un lien externe. Les visiteurs seront redirigés vers votre billetterie existante."
      },
      "tiers": {
        "title": "Tarifs et options",
        "intro": "Créez différents tarifs adaptés à votre événement.",
        "create": "Créez des tarifs (ex : Pass journée, Pass complet, Tarif réduit, Tarif enfant).",
        "price": "Définissez le prix de chaque tarif (gratuit ou payant).",
        "quota": "Limitez le nombre de places disponibles par tarif si nécessaire.",
        "options": "Ajoutez des options supplémentaires aux tarifs (repas, camping, activités).",
        "items": "Associez des articles à restituer (bracelets, badges) à chaque tarif."
      },
      "orders": {
        "title": "Gestion des commandes",
        "intro": "Consultez et gérez toutes les commandes passées.",
        "list": "Affichez la liste complète des commandes avec filtres (statut, date, tarif).",
        "details": "Accédez aux détails de chaque commande : participant, tarif choisi, options, statut de paiement.",
        "status": "Modifiez le statut d'une commande si nécessaire (validée, annulée, remboursée)."
      },
      "access": {
        "title": "Contrôle d'accès",
        "intro": "Validez les entrées des participants le jour de l'événement.",
        "scan": "Scannez les QR codes des billets avec l'appareil photo de votre téléphone ou tablette.",
        "manual": "Recherchez un participant par nom en cas de problème avec le QR code.",
        "validation": "Le système vérifie automatiquement la validité du billet et indique si l'entrée a déjà été validée."
      },
      "counter": {
        "title": "Comptoirs de vente",
        "intro": "Gérez les points de vente physiques sur votre événement.",
        "create": "Créez un ou plusieurs comptoirs de vente (entrée principale, guichet secondaire, etc.).",
        "sell": "Vendez des billets directement depuis l'interface du comptoir.",
        "cash": "Gérez les paiements en espèces et suivez la caisse."
      },
      "stats": {
        "title": "Statistiques",
        "intro": "Suivez les performances de votre billetterie en temps réel.",
        "sales": "Nombre total de billets vendus et évolution dans le temps.",
        "revenue": "Chiffre d'affaires par tarif et global.",
        "attendance": "Taux de présence : billets vendus vs entrées validées.",
        "tiers": "Répartition des ventes par type de tarif."
      }
    }
  }
}
</i18n>
