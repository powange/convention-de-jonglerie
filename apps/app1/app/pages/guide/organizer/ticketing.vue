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
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.config.anonymous')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-arrow-top-right-on-square"
        :title="t('sections.external.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.external.content') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-currency-euro"
        :title="t('sections.tiers.title')"
        color="blue"
      >
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
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-gift" :title="t('sections.handoutItems.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.handoutItems.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.handoutItems.catalog')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.handoutItems.assign')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.handoutItems.recipients')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.handoutItems.quantity')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.handoutItems.allArtists')
            }}</span>
          </li>
        </ul>

        <UAlert
          icon="i-heroicons-information-circle"
          color="info"
          variant="subtle"
          :title="t('sections.handoutItems.cumulativeTitle')"
          :description="t('sections.handoutItems.cumulativeText')"
        />
      </GuideSection>

      <GuideSection
        icon="i-heroicons-shopping-cart"
        :title="t('sections.orders.title')"
        color="blue"
      >
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
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.access.validation')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-building-storefront"
        :title="t('sections.counter.title')"
        color="blue"
      >
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
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.stats.attendance')
            }}</span>
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
// Le guide est rédigé en français uniquement : ses libellés ne passent pas par i18n, sinon ils
// s'afficheraient sous forme de clés brutes pour les visiteurs dont l'interface est dans une
// autre langue. Ils sont définis ici et rendus tels quels. Cf. l'encart du layout, qui invite
// les non-francophones à utiliser la traduction intégrée de leur navigateur.
const messages = {
  title: 'Billetterie',
  subtitle: "Gérez les inscriptions, les tarifs et le contrôle d'accès.",
  sections: {
    config: {
      title: 'Configuration générale',
      intro: 'Paramétrez les options de base de votre billetterie.',
      onSite:
        "Inscription sur place : autorisez ou non l'ajout manuel de participants le jour de l'événement.",
      anonymous:
        "Commandes anonymes : permettez aux visiteurs de s'inscrire sans créer de compte sur la plateforme.",
    },
    external: {
      title: 'Billetterie externe',
      content:
        'Si vous utilisez déjà une plateforme de billetterie (HelloAsso, Infomaniak, etc.), connectez-la à votre édition. Les visiteurs sont redirigés vers votre billetterie existante.',
    },
    tiers: {
      title: 'Tarifs et options',
      intro: 'Créez différents tarifs adaptés à votre événement.',
      create: 'Créez des tarifs (ex : Pass journée, Pass complet, Tarif réduit, Tarif enfant).',
      price: 'Définissez le prix de chaque tarif (gratuit ou payant).',
      quota: 'Limitez le nombre de places disponibles par tarif si nécessaire.',
      options: 'Ajoutez des options supplémentaires aux tarifs (repas, camping, activités).',
    },
    handoutItems: {
      title: 'Articles à remettre',
      intro:
        "Gérez le catalogue des articles à remettre à l'accueil, dans une section dédiée distincte des tarifs.",
      catalog:
        "Créez les articles à remettre lors de la validation d'un billet ou à l'arrivée (bracelets, pass camping, goodies, badges, etc.).",
      assign:
        "Attribuez chaque article aux tarifs, options et repas concernés pour qu'il soit remis avec les bonnes entrées.",
      recipients:
        'Les articles peuvent aussi être destinés aux bénévoles (individuellement ou par équipe), aux artistes (par spectacle) et aux organisateurs, en plus des participants.',
      quantity:
        "Chaque association porte sa propre quantité : un tarif « Pass complet » peut donner droit à 3 tickets boisson là où le « Pass journée » n'en donne qu'un.",
      allArtists:
        "Un raccourci permet d'associer un article à tous les artistes de l'édition d'un coup, sans passer spectacle par spectacle.",
      cumulativeTitle: "L'option « Cumulable »",
      cumulativeText:
        "Un même article peut être dû à plusieurs titres — un artiste qui joue dans deux spectacles, un bénévole qui a aussi un billet. L'option « Cumulable » décide du résultat : cochée, les quantités s'additionnent (2 spectacles × 3 tickets = 6) ; décochée, on retient simplement la plus élevée, ce qui évite de remettre deux bracelets à la même personne. Au moment de valider une entrée, chaque article apparaît une seule fois, avec son total.",
    },
    orders: {
      title: 'Gestion des commandes',
      intro: 'Consultez et gérez toutes les commandes passées.',
      list: 'Affichez la liste complète des commandes avec filtres (statut, date, tarif).',
      details:
        'Accédez aux détails de chaque commande : participant, tarif choisi, options, statut de paiement.',
      status: "Modifiez le statut d'une commande si nécessaire (validée, annulée, remboursée).",
    },
    access: {
      title: "Contrôle d'accès",
      intro: "Validez les entrées des participants le jour de l'événement.",
      scan: "Scannez les QR codes des billets avec l'appareil photo de votre téléphone ou tablette.",
      manual: 'Recherchez un participant par nom en cas de problème avec le QR code.',
      validation:
        "Le système vérifie automatiquement la validité du billet et indique si l'entrée a déjà été validée.",
    },
    counter: {
      title: 'Comptoirs de vente',
      intro: 'Gérez les points de vente physiques sur votre événement.',
      create:
        'Créez un ou plusieurs comptoirs de vente (entrée principale, guichet secondaire, etc.).',
      sell: "Vendez des billets directement depuis l'interface du comptoir.",
      cash: 'Gérez les paiements en espèces et suivez la caisse.',
    },
    stats: {
      title: 'Statistiques',
      intro: 'Suivez les performances de votre billetterie en temps réel.',
      sales: 'Nombre total de billets vendus et évolution dans le temps.',
      revenue: "Chiffre d'affaires par tarif et global.",
      attendance: 'Taux de présence : billets vendus vs entrées validées.',
      tiers: 'Répartition des ventes par type de tarif.',
    },
  },
}

const t = (path: string): string =>
  path.split('.').reduce<any>((value, key) => value?.[key], messages) ?? path

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
