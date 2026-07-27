<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection icon="i-heroicons-user-plus" :title="t('sections.add.title')" color="purple">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.add.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="item in addSteps" :key="item" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ item }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-square-3-stack-3d"
        :title="t('sections.levels.title')"
        color="purple"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.levels.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="item in levelItems" :key="item.label" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">
              <strong>{{ item.label }}</strong> — {{ item.desc }}
            </span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-shield-check"
        :title="t('sections.conventionPerms.title')"
        color="purple"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.conventionPerms.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="right in conventionRights" :key="right.label" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">
              <strong>{{ right.label }}</strong> — {{ right.desc }}
            </span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-adjustments-horizontal"
        :title="t('sections.editionPerms.title')"
        color="purple"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.editionPerms.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="right in editionRights" :key="right.label" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-purple-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">
              <strong>{{ right.label }}</strong> — {{ right.desc }}
            </span>
          </li>
        </ul>

        <UAlert
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="subtle"
          :title="t('sections.editionPerms.warningTitle')"
          :description="t('sections.editionPerms.warningText')"
        />
      </GuideSection>

      <GuideSection icon="i-heroicons-map-pin" :title="t('sections.presence.title')" color="purple">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.presence.content') }}</p>
      </GuideSection>

      <GuideSection icon="i-heroicons-clock" :title="t('sections.history.title')" color="purple">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.history.content') }}</p>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CONVENTION_RIGHTS, EDITION_RIGHTS } from '~~/shared/utils/organizer-rights'

// Le guide est rédigé en français uniquement : ses libellés ne passent pas par i18n, sinon ils
// s'afficheraient sous forme de clés brutes pour les visiteurs dont l'interface est dans une
// autre langue. Ils sont définis ici et rendus tels quels. Cf. l'encart du layout, qui invite
// les non-francophones à utiliser la traduction intégrée de leur navigateur.
const messages = {
  title: 'Co-organisateurs & Permissions',
  subtitle: 'Invitez des collaborateurs et donnez à chacun exactement les droits dont il a besoin.',
  sections: {
    add: {
      title: 'Ajouter un co-organisateur',
      intro: "Invitez des personnes à rejoindre l'équipe d'organisation.",
      search:
        "Recherchez un utilisateur déjà inscrit par e-mail ou par pseudo, puis ajoutez-le à l'équipe.",
      invite:
        "Si la personne n'a pas encore de compte, saisissez son e-mail : elle reçoit une invitation contenant un lien qui lui permet de choisir son mot de passe et de rejoindre directement l'équipe.",
      customTitle:
        "Attribuez un titre personnalisé (ex : « Responsable bénévoles », « Trésorier ») affiché dans la liste de l'équipe.",
      notification: "L'invité reçoit une notification dès son ajout.",
    },
    levels: {
      title: 'Deux niveaux de droits',
      intro:
        'Un même droit peut être accordé à deux échelles différentes. Comprendre cette distinction évite bien des surprises :',
      convention: {
        label: 'Au niveau de la convention',
        desc: "le droit s'applique à toutes les éditions, y compris celles créées plus tard. Pratique pour un membre permanent de l'équipe.",
      },
      edition: {
        label: "Au niveau d'une édition",
        desc: 'le droit ne vaut que pour cette édition précise. Adapté à un renfort ponctuel, recruté pour une seule année.',
      },
    },
    conventionPerms: {
      title: 'Droits au niveau convention',
      intro: "Ces droits s'appliquent à la convention et à l'ensemble de ses éditions :",
      editConvention: {
        label: 'Modifier la convention',
        desc: 'modifier les informations de la convention elle-même (nom, description, logo).',
      },
      deleteConvention: {
        label: 'Supprimer la convention',
        desc: 'supprimer la convention entière, avec toutes ses éditions.',
      },
      manageOrganizers: {
        label: 'Gérer les organisateurs',
        desc: 'ajouter ou retirer des co-organisateurs et modifier leurs droits. À accorder avec parcimonie.',
      },
      addEdition: {
        label: 'Ajouter des éditions',
        desc: 'créer de nouvelles éditions pour cette convention.',
      },
      editAllEditions: {
        label: 'Informations (toutes les éditions)',
        desc: "modifier les informations générales de n'importe quelle édition : description, dates, lieu, services, carte, liens externes et modules activés.",
      },
      deleteAllEditions: {
        label: 'Supprimer toutes les éditions',
        desc: "supprimer n'importe quelle édition de la convention.",
      },
      manageVolunteers: {
        label: 'Gérer les bénévoles',
        desc: 'appel à bénévoles, candidatures, équipes, planning et notifications, sur toutes les éditions.',
      },
      manageArtists: {
        label: 'Gérer les artistes',
        desc: 'appels à spectacles, candidatures, programmation et espace artiste, sur toutes les éditions.',
      },
      manageMeals: {
        label: 'Gérer les repas',
        desc: 'configuration des repas, listes récapitulatives et validation sur place.',
      },
      manageTicketing: {
        label: 'Gérer la billetterie',
        desc: "tarifs, options, commandes, contrôle d'accès, comptoirs et statistiques.",
      },
      manageTasks: {
        label: 'Gérer les tâches',
        desc: 'groupes de tâches, assignations, étiquettes et checklists.',
      },
      manageStock: {
        label: 'Gérer le stock matériel',
        desc: 'inventaire, prêts externes et réservations de matériel.',
      },
      manageWorkshops: {
        label: 'Gérer les workshops',
        desc: "créer et programmer les ateliers proposés pendant l'édition.",
      },
      manageFAQ: {
        label: 'Gérer la FAQ',
        desc: "rédiger et organiser les questions fréquentes de l'édition.",
      },
    },
    editionPerms: {
      title: 'Droits par édition',
      intro:
        'Les mêmes droits métier peuvent être accordés édition par édition, en complément ou à la place des droits de convention :',
      edit: {
        label: 'Informations',
        desc: "modifier les informations générales de l'édition : description, dates, lieu, services, carte, liens externes et modules activés.",
      },
      delete: {
        label: 'Supprimer',
        desc: 'supprimer cette édition.',
      },
      manageVolunteers: {
        label: 'Bénévoles',
        desc: 'appel à bénévoles, candidatures, équipes, planning et notifications.',
      },
      manageArtists: {
        label: 'Artistes',
        desc: 'appels à spectacles, candidatures, programmation des spectacles et espace artiste.',
      },
      manageMeals: {
        label: 'Repas',
        desc: 'configuration des repas, listes et validation sur place.',
      },
      manageTicketing: {
        label: 'Billetterie',
        desc: "tarifs, options, articles à remettre, commandes, contrôle d'accès et comptoirs.",
      },
      manageTasks: {
        label: 'Tâches',
        desc: 'groupes de tâches, assignations, étiquettes et checklists.',
      },
      manageStock: {
        label: 'Stock matériel',
        desc: 'inventaire, prêts externes et réservations.',
      },
      manageWorkshops: {
        label: 'Workshops',
        desc: 'créer et programmer les ateliers.',
      },
      manageFAQ: {
        label: 'FAQ',
        desc: 'rédiger et organiser les questions fréquentes.',
      },
      warningTitle: '« Informations » ne donne pas accès aux modules',
      warningText:
        "Le droit « Informations » couvre uniquement la fiche de l'édition : description, dates, lieu, services, carte, liens externes et activation des modules. Il n'ouvre aucun module métier. Pour que quelqu'un accède aux bénévoles, aux artistes, à la billetterie ou à la FAQ, il faut lui accorder explicitement le droit correspondant — sans quoi les liens vers ces pages ne lui apparaîtront même pas.",
    },
    presence: {
      title: "Présence sur l'édition",
      content:
        "Indiquez quels organisateurs seront physiquement présents lors de l'édition. Cette information sert à la coordination sur place et peut être affichée aux bénévoles et aux participants.",
    },
    history: {
      title: 'Historique',
      content:
        "Consultez l'historique des modifications de droits pour chaque co-organisateur. Chaque changement est horodaté et tracé, ce qui permet de savoir qui a accordé quoi et quand.",
    },
  },
}

const t = (path: string): string =>
  path.split('.').reduce<any>((value, key) => value?.[key], messages) ?? path

definePageMeta({ layout: 'guide', title: 'Guide - Co-organisateurs' })

useHead({
  title: 'Guide Co-organisateurs | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide organisateur : inviter des co-organisateurs, gérer les permissions granulaires par convention et par édition.',
    },
  ],
})

const addSteps = computed(() => [
  t('sections.add.search'),
  t('sections.add.invite'),
  t('sections.add.customTitle'),
  t('sections.add.notification'),
])

const levelItems = computed(() =>
  ['convention', 'edition'].map((key) => ({
    label: t(`sections.levels.${key}.label`),
    desc: t(`sections.levels.${key}.desc`),
  }))
)

// Les deux listes dérivent de la source unique : un droit ajouté au schéma et à
// shared/utils/organizer-rights apparaît ici automatiquement. S'il n'a pas de libellé, le test
// permissions-sync.test.ts le signale.
const conventionRights = computed(() =>
  CONVENTION_RIGHTS.map((key) => ({
    label: t(`sections.conventionPerms.${key}.label`),
    desc: t(`sections.conventionPerms.${key}.desc`),
  }))
)

// Le guide nomme les droits d'édition sans le préfixe `can` : canManageFAQ → manageFAQ.
const editionRights = computed(() =>
  EDITION_RIGHTS.map((right) => {
    const key = right.charAt(3).toLowerCase() + right.slice(4)
    return {
      label: t(`sections.editionPerms.${key}.label`),
      desc: t(`sections.editionPerms.${key}.desc`),
    }
  })
)
</script>
