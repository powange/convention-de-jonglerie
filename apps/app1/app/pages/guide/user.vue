<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-magnifying-glass"
        :title="t('sections.discover.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.discover.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.discover.search.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.discover.search.content') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.discover.views.title') }}
        </h3>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.discover.views.grid')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.discover.views.calendar')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.discover.views.map')
            }}</span>
          </li>
        </ul>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.discover.details.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.discover.details.content') }}</p>
      </GuideSection>

      <GuideSection icon="i-heroicons-heart" :title="t('sections.favorites.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.favorites.content') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.favorites.add') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.favorites.page') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-hand-thumb-up"
        :title="t('sections.participate.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.participate.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.participate.attendance.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('sections.participate.attendance.content') }}
        </p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.participate.carpool.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('sections.participate.carpool.content') }}
        </p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.participate.posts.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('sections.participate.posts.content') }}
        </p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-squares-2x2"
        :title="t('sections.modules.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.modules.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="item in moduleItems" :key="item.label" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">
              <strong>{{ item.label }}</strong> — {{ item.desc }}
            </span>
          </li>
        </ul>
        <p class="text-sm text-gray-500 dark:text-gray-400 italic">
          {{ t('sections.modules.note') }}
        </p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-chat-bubble-left-right"
        :title="t('sections.communication.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.communication.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.communication.messenger.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('sections.communication.messenger.content') }}
        </p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.communication.notifications.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('sections.communication.notifications.content') }}
        </p>
      </GuideSection>

      <GuideSection icon="i-heroicons-banknotes" :title="t('sections.costs.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.costs.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="item in costItems" :key="item" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ item }}</span>
          </li>
        </ul>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.costs.donate') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-user-circle"
        :title="t('sections.profile.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.profile.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.profile.info') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.profile.photo') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.profile.notifications')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.profile.language')
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
  title: 'Guide Utilisateur',
  subtitle: 'Découvrez les conventions de jonglerie et participez à la communauté.',
  sections: {
    discover: {
      title: 'Découvrir les conventions',
      intro:
        "La page d'accueil vous permet d'explorer toutes les conventions de jonglerie référencées sur la plateforme.",
      search: {
        title: 'Recherche et filtres',
        content:
          "Utilisez la barre de recherche pour trouver une convention par nom. Les filtres avancés vous permettent d'affiner par pays, période, services proposés (camping, restauration, etc.) et bien plus encore.",
      },
      views: {
        title: 'Différentes vues',
        grid: 'Vue grille : parcourez toutes les éditions sous forme de cartes avec leurs informations clés (dates, lieu, services).',
        calendar:
          'Vue calendrier : visualisez les conventions sur un calendrier mensuel pour repérer facilement les dates.',
        map: 'Vue carte : explorez géographiquement les conventions sur une carte interactive.',
      },
      details: {
        title: "Détails d'une édition",
        content:
          'Cliquez sur une édition pour accéder à sa page complète : description, dates, lieu, carte interactive, programme des spectacles, covoiturage et publications.',
      },
    },
    favorites: {
      title: 'Gérer ses favoris',
      content: 'Marquez vos conventions préférées pour les retrouver facilement.',
      add: "Cliquez sur l'icône étoile sur une édition pour l'ajouter à vos favoris.",
      page: 'Retrouvez tous vos favoris dans la page « Mes favoris » accessible depuis le menu.',
    },
    participate: {
      title: 'Participer à une édition',
      intro: 'Plusieurs fonctionnalités vous permettent de participer activement aux conventions.',
      attendance: {
        title: 'Indiquer sa participation',
        content:
          "Sur la page d'une édition, cliquez sur le bouton « Je participe » pour signaler votre présence. Cela permet aux organisateurs de mieux anticiper le nombre de participants.",
      },
      carpool: {
        title: 'Covoiturage',
        content:
          'Proposez un trajet ou recherchez un covoiturage pour vous rendre à la convention. Vous pouvez indiquer votre point de départ, le nombre de places disponibles et vos préférences.',
      },
      posts: {
        title: 'Publications et commentaires',
        content:
          "Participez aux échanges en publiant des messages ou en commentant les publications des autres participants sur le fil d'actualité de l'édition.",
      },
    },
    modules: {
      title: "Les modules d'une édition",
      intro:
        "Selon ce que l'organisateur a activé, des entrées supplémentaires apparaissent dans le menu de l'édition :",
      faq: {
        label: 'FAQ',
        desc: 'les réponses aux questions fréquentes : accès, horaires, camping, animaux, moyens de paiement…',
      },
      workshops: {
        label: 'Workshops',
        desc: 'le programme des ateliers, avec leur niveau, le matériel nécessaire et le nombre de places. Vous pouvez vous y inscrire directement.',
      },
      map: {
        label: 'Carte du site',
        desc: 'le plan interactif du terrain : zones, scènes, camping, sanitaires, avec une légende cliquable.',
      },
      showsCall: {
        label: 'Appels à spectacles',
        desc: 'les appels ouverts aux artistes. Consultables par tous, la candidature demande un profil artiste.',
      },
      lostFound: {
        label: 'Objets trouvés',
        desc: 'le registre des objets perdus et retrouvés. Vous pouvez y signaler un objet que vous avez trouvé.',
      },
      note: "Un module absent du menu signifie simplement que l'organisateur ne l'a pas activé pour cette édition.",
    },
    communication: {
      title: 'Rester en contact',
      intro: 'Deux canaux vous tiennent informé de ce qui vous concerne.',
      messenger: {
        title: 'Messagerie',
        content:
          "La messagerie intégrée vous permet d'échanger directement avec les organisateurs — pour une question sur une candidature bénévole ou artiste, ou un point d'organisation. Les conversations sont regroupées par édition et restent accessibles depuis le menu principal.",
      },
      notifications: {
        title: 'Notifications',
        content:
          "Vous êtes averti des événements qui vous concernent : réponse à une candidature, message reçu, rappel avant un créneau bénévole. La cloche du menu regroupe l'historique, et vous choisissez dans votre profil ce que vous souhaitez recevoir par e-mail ou en notification push sur votre téléphone.",
      },
    },
    costs: {
      title: 'Coûts du projet',
      intro:
        'La plateforme est développée bénévolement. La page « Coûts du projet », accessible depuis le pied de page, affiche sans filtre ce que son fonctionnement coûte réellement :',
      breakdown:
        'Le détail des dépenses par catégorie : hébergement, nom de domaine, électricité, matériel, logiciels et services.',
      recurring:
        "La distinction entre les frais récurrents, ramenés au mois et à l'année, et les achats ponctuels.",
      autonomy:
        "Un indicateur d'autonomie : combien de temps le projet peut encore tourner avec ce qui a été reçu.",
      balance:
        'Le solde du moment, qui indique si les dons sont en avance ou si le développeur avance de sa poche.',
      donate:
        "Si vous souhaitez soutenir le projet, vous pouvez offrir un café — 1 € l'unité, quantité libre, paiement par Stripe. C'est entièrement facultatif : rien sur la plateforme n'est réservé aux donateurs, et les dons peuvent être suspendus quand le projet est à l'équilibre.",
    },
    profile: {
      title: 'Mon profil',
      intro: 'Personnalisez votre expérience en configurant votre profil.',
      info: 'Modifiez vos informations personnelles (nom, prénom, pseudo).',
      photo: 'Ajoutez ou changez votre photo de profil.',
      notifications: 'Configurez vos préférences de notifications (e-mail, push).',
      language: "Changez la langue de l'interface via le sélecteur en bas de page.",
    },
  },
}

const t = (path: string): string =>
  path.split('.').reduce<any>((value, key) => value?.[key], messages) ?? path

const costItems = computed(() => [
  t('sections.costs.breakdown'),
  t('sections.costs.recurring'),
  t('sections.costs.autonomy'),
  t('sections.costs.balance'),
])

definePageMeta({
  layout: 'guide',
  title: 'Guide - Utilisateur',
})

useHead({
  title: 'Guide Utilisateur | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide des fonctionnalités pour les utilisateurs : découvrir les conventions, gérer ses favoris, participer, communiquer et personnaliser son profil.',
    },
  ],
})

// Modules qu'un organisateur peut activer sur son édition, vus côté participant.
const MODULE_KEYS = ['faq', 'workshops', 'map', 'showsCall', 'lostFound']

const moduleItems = computed(() =>
  MODULE_KEYS.map((key) => ({
    label: t(`sections.modules.${key}.label`),
    desc: t(`sections.modules.${key}.desc`),
  }))
)
</script>
