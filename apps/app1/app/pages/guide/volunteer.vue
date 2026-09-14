<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-document-text"
        :title="t('sections.apply.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.apply.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.apply.find.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.apply.find.content') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.apply.form.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.apply.form.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.apply.form.info')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.apply.form.availability')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.apply.form.teamPrefs')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.apply.form.emergency')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.apply.form.dietary')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-clipboard-document-list"
        :title="t('sections.tracking.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.tracking.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.tracking.page') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.tracking.statuses')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.tracking.modify')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.tracking.notifications')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-calendar-days"
        :title="t('sections.planning.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.planning.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.planning.schedule.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('sections.planning.schedule.content') }}
        </p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.planning.export.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.planning.export.content') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.planning.empty.title') }}
        </h3>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-eye-slash" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.empty.notPublished')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-bolt" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.empty.floating')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-lock-closed" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.planning.empty.autonomous')
            }}</span>
          </li>
        </ul>
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('sections.planning.empty.otherwise') }}
        </p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-arrows-right-left"
        :title="t('sections.swaps.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.propose') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.overlap') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.accept') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.approve') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.closed') }}</span>
          </li>
        </ul>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.swaps.floating') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-chat-bubble-left-right"
        :title="t('sections.communication.title')"
        color="green"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.communication.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.communication.orgNotifications')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.communication.confirm')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.communication.messaging')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-qr-code" :title="t('sections.during.title')" color="green">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.during.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.during.qrcode') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.during.meals') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-green-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.during.team') }}</span>
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
  title: 'Guide Bénévole',
  subtitle: 'Participez en tant que bénévole et gérez vos créneaux.',
  sections: {
    apply: {
      title: 'Postuler comme bénévole',
      intro:
        "Rejoignez l'équipe de bénévoles d'une convention pour vivre l'événement de l'intérieur.",
      find: {
        title: 'Trouver un appel',
        content:
          "Sur la page d'une édition, si un appel à bénévoles est ouvert, un bouton « Devenir bénévole » est visible. Certains organisateurs partagent également un lien direct vers le formulaire de candidature.",
      },
      form: {
        title: 'Formulaire de candidature',
        intro: 'Le formulaire de candidature vous demande plusieurs informations :',
        info: 'Informations personnelles (nom, prénom, téléphone).',
        availability: "Vos disponibilités pendant l'événement.",
        teamPrefs: "Vos préférences d'équipes et de créneaux horaires.",
        emergency: "Contact d'urgence.",
        dietary: 'Allergies alimentaires et régime spécial (pour les repas bénévoles).',
      },
    },
    tracking: {
      title: 'Suivi de candidature',
      intro: 'Suivez le statut de vos candidatures bénévoles.',
      page: 'Accédez à la page « Mes candidatures bénévoles » depuis le menu de votre profil.',
      statuses: 'Consultez le statut : en attente, accepté ou refusé.',
      modify: "Vous pouvez modifier ou retirer votre candidature tant qu'elle est en attente.",
      notifications:
        'Vous recevez une notification lorsque votre candidature est acceptée ou refusée.',
    },
    planning: {
      title: 'Planning et créneaux',
      intro: 'Une fois accepté, consultez votre planning de bénévole.',
      schedule: {
        title: 'Voir ses créneaux',
        content:
          "Votre planning affiche tous vos créneaux assignés dans un calendrier interactif. Vous pouvez voir l'équipe, l'horaire et le lieu de chaque créneau.",
      },
      export: {
        title: 'Exporter le planning',
        content:
          "Exportez votre planning personnel au format iCal (pour l'ajouter à votre agenda) ou en PDF (pour l'imprimer).",
      },
      empty: {
        title: 'Votre planning est vide ? Trois raisons possibles',
        notPublished:
          "Le planning n'est pas encore publié. Les organisateurs le construisent par itérations et ne le montrent qu'une fois stabilisé — mieux vaut ne rien voir que noter des horaires qui changeront le lendemain. Vous serez prévenu à sa publication.",
        floating:
          "Vous êtes bénévole volant. C'est normal et c'est le principe : vous êtes à disposition pendant l'événement pour renforcer les équipes qui en ont besoin, sans créneau fixe. Si on vous place sur un créneau, il apparaîtra ici. Un encart vous l'indique sur votre page bénévole.",
        autonomous:
          "Votre équipe est autonome : elle s'organise elle-même, en dehors de l'outil. Vos horaires se décident donc avec elle, et non dans le planning de l'édition.",
        otherwise:
          'Hors de ces trois cas, les affectations sont peut-être simplement encore à faire — demandez à votre responsable.',
      },
    },
    swaps: {
      title: 'Échanger un créneau',
      intro:
        "Un empêchement, un horaire qui ne vous arrange plus : vous pouvez proposer l'un de vos créneaux à un autre bénévole, sans passer par l'organisation pour trouver la personne.",
      propose:
        'Depuis votre espace bénévole, choisissez le créneau que vous cédez et celui que vous souhaitez en échange, parmi ceux de vos équipes.',
      overlap:
        'Les créneaux qui chevaucheraient un des vôtres ne vous sont pas proposés : un échange ne doit pas vous mettre à deux endroits à la fois.',
      accept:
        "L'autre bénévole reçoit votre proposition et l'accepte ou la refuse. Vous pouvez retirer votre demande tant qu'elle est en attente.",
      approve:
        "Un organisateur valide ensuite l'échange. Rien ne change au planning avant cette validation — c'est lui qui vérifie que le créneau reste correctement tenu.",
      closed:
        "Les organisateurs peuvent fermer les échanges pour leur édition ; l'option disparaît alors de votre espace.",
      floating:
        "Les bénévoles volants n'échangent pas : n'étant tenus à aucun volume d'heures, ils n'ont ni créneau à céder ni créneau à reprendre.",
    },
    communication: {
      title: 'Communication',
      intro: 'Restez informé des dernières actualités et consignes des organisateurs.',
      orgNotifications:
        'Recevez les notifications envoyées par les organisateurs (rappels, changements de planning, informations importantes).',
      confirm:
        'Confirmez la lecture des messages importants pour que les organisateurs sachent que vous êtes informé.',
      messaging:
        'Utilisez la messagerie intégrée pour communiquer avec les organisateurs si vous avez des questions.',
    },
    during: {
      title: "Pendant l'événement",
      intro: 'Quelques fonctionnalités utiles pendant la convention.',
      qrcode: 'Votre QR code bénévole peut être scanné pour valider votre présence et vos accès.',
      meals: 'Consultez les repas prévus pour les bénévoles selon vos créneaux.',
      team: "Retrouvez les informations de votre équipe et de vos responsables d'équipe.",
    },
  },
}

const t = (path: string): string =>
  path.split('.').reduce<any>((value, key) => value?.[key], messages) ?? path

definePageMeta({
  layout: 'guide',
  title: 'Guide - Bénévole',
})

useHead({
  title: 'Guide Bénévole | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide pour les bénévoles : postuler, consulter votre planning, gérer vos créneaux et communiquer avec les organisateurs.',
    },
  ],
})
</script>
