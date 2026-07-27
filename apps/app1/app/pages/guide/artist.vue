<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-sparkles"
        :title="t('sections.activate.title')"
        color="yellow"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.activate.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.activate.category')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.activate.stageName')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.activate.bio') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.activate.social')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-megaphone"
        :title="t('sections.showCalls.title')"
        color="yellow"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.showCalls.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.showCalls.find') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.showCalls.criteria')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.showCalls.deadline')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-paper-airplane"
        :title="t('sections.apply.title')"
        color="yellow"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.apply.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.apply.form.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.apply.form.content') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.apply.form.showTitle')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.apply.form.description')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.apply.form.duration')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.apply.form.additionalArtists')
            }}</span>
          </li>
        </ul>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.apply.needs.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.apply.needs.content') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-clipboard-document-check"
        :title="t('sections.tracking.title')"
        color="yellow"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.tracking.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tracking.page') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.tracking.statuses')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.tracking.modify')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.tracking.messaging')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-identification"
        :title="t('sections.space.title')"
        color="yellow"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.space.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="item in spaceItems" :key="item.label" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-yellow-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">
              <strong>{{ item.label }}</strong> — {{ item.desc }}
            </span>
          </li>
        </ul>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.space.editable') }}</p>
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
  title: 'Guide Artiste',
  subtitle: 'Proposez vos spectacles, suivez vos candidatures et préparez votre venue.',
  sections: {
    space: {
      title: 'Mon espace artiste',
      intro:
        "Une fois votre candidature retenue, un espace personnel s'ouvre sur la page de l'édition. Il rassemble tout ce qui vous concerne pour cette convention, sans avoir à relancer l'organisation :",
      shows: {
        label: 'Mes spectacles',
        desc: 'les spectacles où vous êtes programmé, avec leur horaire et leur lieu.',
      },
      qrcode: {
        label: 'QR code artiste',
        desc: "votre code personnel, scanné à l'entrée pour valider votre accès et les articles qui vous sont dus.",
      },
      meals: {
        label: 'Mes repas',
        desc: "les repas qui vous sont attribués selon vos horaires de présence, y compris le repas d'après-spectacle.",
      },
      accommodation: {
        label: 'Mon hébergement',
        desc: "la proposition de l'organisation, ou l'indication que vous venez en autonomie. Le type d'hébergement est précisé.",
      },
      transport: {
        label: 'Mon transport',
        desc: "vos horaires d'arrivée et de départ, et si vous avez besoin d'être récupéré sur place.",
      },
      payment: {
        label: 'Paiement et remboursements',
        desc: 'le cachet demandé et celui accordé, le statut de votre facture, et le suivi de vos consommables (plafond, dépenses réelles, montants payés ou en attente).',
      },
      editable:
        "Deux informations restent modifiables par vous à tout moment : votre préférence alimentaire (dont les régimes végétarien et végétalien) et vos allergies, avec leur degré de gravité. Autant les renseigner tôt : elles alimentent directement les listes de repas de l'organisation.",
    },
    activate: {
      title: 'Activer le profil artiste',
      intro:
        "Pour candidater aux appels à spectacles, vous devez d'abord activer votre profil artiste dans les paramètres de votre compte.",
      category: 'Choisissez votre catégorie artistique (jonglage, acrobatie, clown, feu, etc.).',
      stageName: 'Renseignez votre nom de scène ou nom de compagnie.',
      bio: 'Rédigez une biographie présentant votre parcours et votre style.',
      social: 'Ajoutez vos liens vers vos réseaux sociaux et votre site web.',
    },
    showCalls: {
      title: 'Appels à spectacles',
      intro:
        'Les organisateurs de conventions peuvent publier des appels à spectacles pour recruter des artistes.',
      find: 'Consultez les appels à spectacles ouverts sur la page dédiée de chaque édition.',
      criteria:
        'Chaque appel précise les types de spectacles recherchés et les conditions proposées.',
      deadline: "Respectez les dates limites de candidature indiquées par l'organisateur.",
    },
    apply: {
      title: 'Candidater à un appel',
      intro:
        'Lorsque vous trouvez un appel qui vous intéresse, soumettez votre candidature avec les informations de votre spectacle.',
      form: {
        title: 'Formulaire de candidature',
        content: 'Le formulaire vous demande les informations suivantes :',
        showTitle: 'Titre du spectacle.',
        description: 'Description détaillée du numéro proposé.',
        duration: 'Durée estimée du spectacle.',
        additionalArtists: 'Artistes supplémentaires participant au numéro (si applicable).',
      },
      needs: {
        title: 'Besoins techniques',
        content:
          'Précisez vos besoins techniques et logistiques (espace scénique, matériel, son, lumière) pour permettre aux organisateurs de préparer au mieux votre accueil.',
      },
    },
    tracking: {
      title: 'Suivi des candidatures',
      intro: "Suivez l'avancement de toutes vos candidatures depuis un espace dédié.",
      page: 'Accédez à la page « Mes candidatures artiste » depuis le menu de votre profil.',
      statuses: 'Consultez le statut de chaque candidature : en attente, acceptée ou refusée.',
      modify: "Vous pouvez modifier ou retirer votre candidature tant qu'elle est en attente.",
      messaging:
        'Communiquez avec les organisateurs via la messagerie intégrée si vous avez des questions.',
    },
  },
}

const t = (path: string): string =>
  path.split('.').reduce<any>((value, key) => value?.[key], messages) ?? path

// Rubriques de l'espace artiste, dans l'ordre où elles apparaissent sur la page.
const SPACE_KEYS = ['shows', 'qrcode', 'meals', 'accommodation', 'transport', 'payment']

const spaceItems = computed(() =>
  SPACE_KEYS.map((key) => ({
    label: t(`sections.space.${key}.label`),
    desc: t(`sections.space.${key}.desc`),
  }))
)

definePageMeta({
  layout: 'guide',
  title: 'Guide - Artiste',
})

useHead({
  title: 'Guide Artiste | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide pour les artistes : activer votre profil, répondre aux appels à spectacles et suivre vos candidatures.',
    },
  ],
})
</script>
