<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-question-mark-circle"
        :title="t('sections.faq.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.faq.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="item in faqItems" :key="item" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ item }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-calendar-days"
        :title="t('sections.program.title')"
        color="indigo"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.program.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.program.enable') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.program.publish')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.program.sources')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.program.external')
            }}</span>
          </li>
        </ul>
      </GuideSection>

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
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.workshops.places')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.workshops.location')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.workshops.import')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-indigo-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.workshops.edit') }}</span>
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
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.lostFound.comment')
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
// Le guide est rédigé en français uniquement : ses libellés ne passent pas par i18n, sinon ils
// s'afficheraient sous forme de clés brutes pour les visiteurs dont l'interface est dans une
// autre langue. Ils sont définis ici et rendus tels quels. Cf. l'encart du layout, qui invite
// les non-francophones à utiliser la traduction intégrée de leur navigateur.
const messages = {
  title: 'Autres fonctionnalités',
  subtitle: 'FAQ, programme, workshops, objets trouvés, publications et covoiturage.',
  sections: {
    faq: {
      title: 'FAQ',
      intro:
        "Répondez d'avance aux questions qui reviennent chaque année : accès, horaires, camping, animaux, moyens de paiement…",
      create:
        "Rédigez chaque question et sa réponse avec l'éditeur Markdown : titres, listes, gras, liens et emojis sont pris en charge.",
      organize: 'Réordonnez les entrées par glisser-déposer pour placer les plus utiles en tête.',
      visibility:
        "L'interrupteur « Visible publiquement » décide de l'affichage : tant qu'il est désactivé, l'entrée reste réservée à l'équipe d'organisation et n'apparaît pas sur la page publique.",
    },
    workshops: {
      title: 'Workshops',
      intro:
        "Le programme des ateliers de votre édition. Vous n'êtes pas seul à le remplir : un atelier peut être proposé par un organisateur, un bénévole accepté, un artiste programmé ou toute personne munie d'un billet.",
      create:
        "Créez un atelier avec un titre, une description, une heure de début et, si vous la connaissez, une heure de fin — elle est facultative, bien des ateliers durent ce qu'ils durent.",
      places:
        "Le nombre de places est indicatif : il n'y a pas d'inscription, on se présente à l'heure dite. Les participants peuvent en revanche marquer un atelier comme favori.",
      location:
        "Le lieu se choisit parmi ceux de l'édition, et un réglage décide si l'on peut en saisir un nouveau au passage ou s'en tenir à la liste. Un lieu peut être rattaché à une zone ou à un repère de la carte du site.",
      import:
        "Une affiche photographiée suffit à remplir le programme : l'import en extrait les ateliers, que vous relisez et corrigez avant de les enregistrer.",
      edit: "Un atelier se modifie et se supprime par son auteur ou par l'équipe d'organisation.",
    },
    lostFound: {
      title: 'Objets trouvés',
      intro:
        "Le registre des objets perdus et retrouvés de votre édition. Il n'y a rien à activer : l'onglet apparaît de lui-même le jour où l'édition commence.",
      activate:
        "Et il ne se referme pas à la fin. C'est voulu : on réclame un objet oublié dans les jours qui suivent la convention, rarement pendant.",
      report:
        "C'est l'équipe d'organisation qui inscrit un objet au registre, avec photo et description : on lui remet ce qu'on a trouvé, elle le consigne. Et pas avant le début de l'édition — un objet perdu ne précède pas la convention.",
      comment:
        "Tout compte connecté peut commenter un objet, pour le réclamer ou donner une précision. C'est par là que passe l'échange avec son propriétaire.",
      list: 'Consultez la liste de tous les objets signalés depuis le tableau de bord.',
      recover: 'Marquez un objet comme récupéré lorsque son propriétaire le réclame.',
    },
    program: {
      title: 'Programme',
      intro:
        "La frise horaire de l'édition, qui réunit sur une même ligne de temps les ateliers, les spectacles et les éléments que vous ajoutez librement (repas, ouverture du camping, veillée…).",
      enable:
        "Activez le module « Programme » depuis les informations de l'édition. Comme les autres modules, il est éteint au départ : une édition qui n'a rien saisi ne doit pas exposer un onglet vide.",
      publish:
        "La visibilité publique de la frise est un réglage SÉPARÉ de l'activation — on compose un programme pendant des semaines avant qu'il ne mérite d'être montré. Tant qu'il est fermé, vous seuls le voyez.",
      sources:
        'Les ateliers et les spectacles y remontent tout seuls depuis leurs modules : vous ne les ressaisissez pas ici.',
      external:
        "Si vous tenez déjà votre programme sur votre propre site, renseignez-en simplement l'adresse dans les informations de l'édition.",
    },
    publications: {
      title: 'Publications',
      intro: "Publiez des actualités sur le fil d'activité de votre édition.",
      create:
        'Créez des publications pour informer les participants des nouveautés, changements ou rappels.',
      content: 'Ajoutez du texte, des images et des liens à vos publications.',
      visibility: "Les publications sont visibles par tous les visiteurs de la page de l'édition.",
    },
    carpooling: {
      title: 'Covoiturage',
      intro: "Facilitez l'accès à votre événement grâce au covoiturage.",
      feature:
        'Les participants peuvent proposer ou rechercher des trajets de covoiturage vers votre édition.',
      moderation:
        "En tant qu'organisateur, vous pouvez modérer les annonces de covoiturage si nécessaire.",
    },
  },
}

const t = (path: string): string =>
  path.split('.').reduce<any>((value, key) => value?.[key], messages) ?? path

definePageMeta({ layout: 'guide', title: 'Guide - Autres fonctionnalités' })

useHead({
  title: 'Guide Autres fonctionnalités | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content: 'Guide organisateur : FAQ, workshops, objets trouvés, publications et covoiturage.',
    },
  ],
})

const faqItems = computed(() => [
  t('sections.faq.create'),
  t('sections.faq.organize'),
  t('sections.faq.visibility'),
])
</script>
