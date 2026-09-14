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

      <GuideSection icon="i-heroicons-tag" :title="t('sections.tags.title')" color="amber">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.tags.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tags.create') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tags.assign') }}</span>
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
              t('sections.externalLoan.pickup')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-amber-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.externalLoan.places')
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
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.externalLoan.page') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-calendar-days"
        :title="t('sections.reservations.title')"
        color="amber"
      >
        <UAlert
          icon="i-heroicons-power"
          color="warning"
          variant="subtle"
          title="Les réservations ne sont pas actives par défaut"
          :description="t('sections.reservations.enable')"
        />
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.reservations.disable') }}</p>
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

      <GuideSection
        icon="i-heroicons-clipboard-document-check"
        :title="t('sections.recount.title')"
        color="orange"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.recount.intro') }}</p>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.recount.field') }}</p>
        <UAlert
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="subtle"
          :title="t('sections.recount.emptyTitle')"
          :description="t('sections.recount.emptyText')"
        />
      </GuideSection>

      <GuideSection
        icon="i-heroicons-magnifying-glass-circle"
        :title="t('sections.missing.title')"
        color="orange"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.missing.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.missing.buy') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.missing.count') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.missing.description')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-shopping-cart"
        :title="t('sections.shopping.title')"
        color="orange"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.shopping.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.shopping.several')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.shopping.check') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.shopping.selectable')
            }}</span>
          </li>
        </ul>
        <UAlert
          icon="i-heroicons-link"
          color="neutral"
          variant="subtle"
          :title="t('sections.shopping.liveTitle')"
          :description="t('sections.shopping.liveText')"
        />
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
  title: 'Gestion du matériel',
  subtitle:
    "Inventoriez le matériel de votre édition, suivez les emprunts et les réservations, et sachez ce qu'il faudra racheter après coup.",
  sections: {
    groups: {
      title: 'Groupes de matériel',
      intro: 'Le matériel est organisé en groupes pour structurer votre inventaire.',
      create: 'Créez autant de groupes que nécessaire, avec un nom et une description optionnelle.',
      examples:
        'Organisez par type de matériel (son, lumière, feu, structures, mobilier…) ou par lieu de stockage.',
      reorder:
        "Réordonnez les groupes par glisser-déposer pour les présenter dans l'ordre qui vous convient.",
    },
    items: {
      title: 'Articles de matériel',
      intro: 'Ajoutez les articles dans chaque groupe pour constituer votre inventaire.',
      fields: 'Chaque article possède un nom, une description et des notes optionnelles.',
      quantity: "Indiquez la quantité d'exemplaires identiques disponibles pour cet article.",
      location:
        "Définissez l'emplacement de rangement : texte libre, zone ou marqueur de la carte interactive.",
    },
    tags: {
      title: 'Étiquettes',
      intro:
        'Les groupes rangent le matériel ; les étiquettes le retrouvent en travers des groupes.',
      create:
        "Créez des étiquettes colorées propres à l'édition (ex : « fragile », « à réparer », « prêté par le club »).",
      assign:
        'Posez une ou plusieurs étiquettes sur chaque objet, quel que soit son groupe, puis filtrez dessus.',
    },
    externalLoan: {
      title: 'Matériel emprunté',
      intro:
        "Suivez le matériel prêté par quelqu'un d'extérieur à la convention. Un emprunt a deux bouts — aller le chercher, puis le rapporter —, et l'outil suit les deux.",
      owner: 'Marquez un objet comme emprunté et renseignez le contact de son propriétaire.',
      pickup:
        "Marquez l'objet comme récupéré quand il est effectivement sur place. Tant que ce n'est pas fait, l'emprunt est convenu mais le matériel n'est pas encore là — la distinction évite de compter sur du matériel qui dort encore chez son propriétaire.",
      places:
        'Indiquez le lieu de récupération et le lieu de retour, qui sont souvent différents, ainsi que la personne chargée de chacun — un utilisateur de la plateforme, ou un simple nom pour quelqu’un qui n’a pas de compte.',
      returnDue:
        "Fixez la date prévue de retour, puis marquez l'objet comme rendu une fois restitué.",
      overdue:
        'Les emprunts non rendus dont la date de retour est dépassée sont signalés comme en retard.',
      page: "La page « Emprunts » rassemble tous les emprunts de l'édition, tous groupes confondus, avec des filtres par état (à récupérer, à rendre, en retard, rendu), par lieu et par personne responsable. C'est de là qu'on organise une tournée de récupération ou de retour.",
    },
    reservations: {
      title: 'Réservations',
      enable:
        "Les réservations s'activent GROUPE PAR GROUPE, et sont éteintes sur un groupe nouvellement créé : tout le matériel ne se réserve pas, et un groupe « consommables » ou « décoration » n'a que faire d'un calendrier. Activez-les depuis les réglages du groupe.",
      disable:
        'Les désactiver est refusé tant que le groupe porte des réservations : il faut les traiter avant.',
      intro:
        "Une fois le groupe ouvert aux réservations, réservez du matériel sur des périodes précises pour éviter les conflits d'utilisation.",
      period:
        "Réservez une quantité d'un article sur une période (début et fin), avec un lieu d'utilisation (texte, zone ou marqueur).",
      usage: "Précisez l'usage de la réservation (ex : « Spectacle de feu samedi 22h »).",
      status: "Suivez l'état de chaque réservation : Réservé, Sorti, Rendu ou Annulé.",
      bulk: 'Réservez plusieurs articles en une seule fois grâce à la réservation en masse.',
    },
    planning: {
      title: 'Disponibilité & planning',
      intro: "Gardez une vue d'ensemble de l'utilisation de votre matériel.",
      availability:
        "La disponibilité tient compte des réservations existantes pour éviter de réserver plus d'exemplaires que disponibles.",
      view: "Le planning d'un groupe affiche les réservations dans le temps pour repérer les périodes chargées.",
    },
    recount: {
      title: "Le recomptage de fin d'édition",
      intro:
        "Au rangement, saisissez la quantité réellement retrouvée pour chaque objet. L'écart avec la quantité de départ dit ce qui manque.",
      field:
        "Le champ « Quantité en fin d'édition » se remplit depuis la fiche de l'objet, ou directement depuis la page « Ce qui manque ».",
      emptyTitle: 'Laissez vide tant que le comptage n’a pas eu lieu',
      emptyText:
        "Un objet non compté n'est pas un objet complet. Les confondre ferait passer une caisse jamais ouverte pour une caisse intacte, et la liste de rachat serait fausse sans que rien ne le signale. C'est pourquoi le champ laissé vide affiche « Non compté » plutôt que zéro.",
    },
    missing: {
      title: 'Ce qui manque',
      intro:
        "Une page traverse tous les groupes et rassemble ce qu'il faudra racheter — plus besoin d'ouvrir chaque groupe et de faire la somme de tête.",
      buy: "L'onglet « À racheter » liste les objets dont le recomptage est inférieur à la quantité de départ, avec le nombre d'exemplaires manquants.",
      count:
        "L'onglet « À compter » liste ceux qui n'ont pas encore été recomptés. Le résumé de tête affiche les deux : « 12 exemplaires à racheter » n'a pas le même sens selon qu'il reste 0 ou 40 objets à compter.",
      description:
        "L'icône à côté d'un nom d'objet en rappelle la description, sans quitter la page.",
    },
    shopping: {
      title: 'Les listes de courses',
      intro:
        'Sélectionnez des objets manquants et versez-les dans une liste de courses nommée, que vous cochez au fur et à mesure des achats.',
      several:
        'Plusieurs listes par édition : on rachète en plusieurs fois et à plusieurs endroits (« Quincaillerie », « Magasin de jonglerie »…).',
      check:
        'Cochez chaque ligne une fois achetée. Une pastille dans le menu indique le nombre de listes non terminées, et le résumé de la page les compte aussi.',
      liveTitle: 'Une liste reste liée au matériel, elle n’en est pas une copie',
      liveText:
        "L'article d'une liste ne stocke ni nom ni quantité : il pointe vers l'objet du stock. Renommer l'objet met la liste à jour, et la quantité à racheter suit l'écart du moment. Deux conséquences à connaître : supprimer un objet du stock le retire des listes, et un nouveau recomptage modifie une liste déjà imprimée — un article qui ne manque plus y est signalé comme tel plutôt que retiré en silence.",
      selectable:
        "Seuls les objets manquants sont sélectionnables : un objet non compté n'a pas encore d'écart à racheter.",
    },
  },
}

const t = (path: string): string =>
  path.split('.').reduce<any>((value, key) => value?.[key], messages) ?? path

definePageMeta({ layout: 'guide', title: 'Guide - Gestion du matériel' })

useHead({
  title: 'Guide Gestion du matériel | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        "Guide organisateur : gérez le matériel de votre édition avec des groupes, des étiquettes, les emprunts, les réservations, le recomptage de fin d'édition et les listes de courses.",
    },
  ],
})
</script>
