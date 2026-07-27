<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-6">
      {{ t('subtitle') }}
    </p>

    <UAlert
      icon="i-heroicons-information-circle"
      color="warning"
      variant="subtle"
      :title="t('standalone.title')"
      :description="t('standalone.description')"
      class="mb-8"
    />

    <div class="space-y-6">
      <GuideSection
        icon="i-heroicons-arrow-down-tray"
        :title="t('sections.install.title')"
        color="orange"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.install.intro') }}</p>

        <ul class="space-y-2">
          <li v-for="dl in downloads" :key="dl.os" class="flex items-start gap-2">
            <UIcon
              name="i-heroicons-computer-desktop"
              class="size-5 text-orange-500 mt-0.5 shrink-0"
            />
            <span class="text-gray-600 dark:text-gray-400">
              <strong>{{ dl.os }}</strong> —
              <template v-for="(link, index) in dl.links" :key="link.href">
                <span v-if="index > 0"> · </span>
                <ULink
                  :to="link.href"
                  target="_blank"
                  class="text-primary-600 dark:text-primary-400 underline"
                >
                  {{ link.label }}
                </ULink>
              </template>
            </span>
          </li>
        </ul>

        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.install.updates') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-plus-circle"
        :title="t('sections.create.title')"
        color="orange"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.create.intro') }}</p>

        <GuideScreenshot src="/images/guide/regie-son/accueil.png" :caption="t('shots.accueil')" />

        <ul class="space-y-2">
          <li v-for="item in createSteps" :key="item" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ item }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-queue-list" :title="t('sections.steps.title')" color="orange">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.steps.intro') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.steps.sources.title') }}
        </h3>
        <ul class="space-y-2">
          <li v-for="item in audioSources" :key="item.label" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">
              <strong>{{ item.label }}</strong> — {{ item.desc }}
            </span>
          </li>
        </ul>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.steps.copied') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.steps.pause.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.steps.pause.content') }}</p>

        <GuideScreenshot src="/images/guide/regie-son/editeur.png" :caption="t('shots.editeur')" />
      </GuideSection>

      <GuideSection
        icon="i-heroicons-adjustments-vertical"
        :title="t('sections.settings.title')"
        color="orange"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.settings.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="item in trackSettings" :key="item.label" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">
              <strong>{{ item.label }}</strong> — {{ item.desc }}
            </span>
          </li>
        </ul>

        <GuideScreenshot
          src="/images/guide/regie-son/parametres-piste.png"
          :caption="t('shots.parametres')"
        />

        <UAlert
          icon="i-heroicons-megaphone"
          color="info"
          variant="subtle"
          :title="t('sections.settings.cueTitle')"
          :description="t('sections.settings.cueText')"
        />
      </GuideSection>

      <GuideSection
        icon="i-heroicons-shield-check"
        :title="t('sections.check.title')"
        color="orange"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.check.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="item in checkItems" :key="item" class="flex items-start gap-2">
            <UIcon
              name="i-heroicons-exclamation-triangle"
              class="size-5 text-orange-500 mt-0.5 shrink-0"
            />
            <span class="text-gray-600 dark:text-gray-400">{{ item }}</span>
          </li>
        </ul>

        <GuideScreenshot
          src="/images/guide/regie-son/verification.png"
          :caption="t('shots.verification')"
        />
      </GuideSection>

      <GuideSection
        icon="i-heroicons-paper-airplane"
        :title="t('sections.export.title')"
        color="orange"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.export.intro') }}</p>

        <GuideScreenshot src="/images/guide/regie-son/export.png" :caption="t('shots.export')" />

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.export.file.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.export.file.content') }}</p>

        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
          {{ t('sections.export.cloud.title') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.export.cloud.content') }}</p>

        <UAlert
          icon="i-heroicons-clock"
          color="warning"
          variant="subtle"
          :title="t('sections.export.expiryTitle')"
          :description="t('sections.export.expiryText')"
        />
      </GuideSection>

      <GuideSection
        icon="i-heroicons-inbox-arrow-down"
        :title="t('sections.regisseur.title')"
        color="orange"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.regisseur.intro') }}</p>
        <ul class="space-y-2">
          <li v-for="item in regisseurItems" :key="item" class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-orange-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ item }}</span>
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
  title: 'Régie Son — guide artiste',
  subtitle:
    'Préparez la bande-son de votre numéro chez vous, et transmettez-la prête à jouer au régisseur.',
  // Légendes des captures. Elles servent aussi de texte alternatif : elles décrivent donc ce que
  // montre l'image, et pas seulement ce qu'il faut en retenir.
  shots: {
    accueil:
      "L'écran d'accueil sépare « SPECTACLE » et « NUMÉRO ». En tant qu'artiste, visez « Nouveau numéro », dans le groupe du bas.",
    editeur:
      'Un numéro et ses trois étapes : une musique, une pause, une musique. Le champ « Top de départ » attend sous chacune, et le curseur de volume se règle à droite du nom de la piste.',
    parametres:
      "Les paramètres d'une piste : la forme d'onde en haut, avec son bouton d'écoute, puis les champs de début, de fin et des deux fondus.",
    verification:
      'La vérification signale ici des fondus cumulés plus longs que la durée réellement jouée — de quoi tronquer la musique en représentation.',
    export:
      'La fenêtre d’export propose le fichier « .regiesonnumero » à transmettre soi-même, ou un partage en ligne renvoyant un code.',
  },
  standalone: {
    title: 'Un logiciel séparé, gratuit et open source',
    description:
      "Régie Son n'est pas une fonctionnalité de Juggling Convention : c'est une application à installer sur votre ordinateur, développée à part. Aucun compte n'est nécessaire, et elle fonctionne sans connexion une fois vos musiques ajoutées.",
  },
  sections: {
    install: {
      title: "Installer l'application",
      intro:
        'Téléchargez la version correspondant à votre système. Les liens pointent toujours vers la dernière version publiée :',
      updates:
        "Une fois installée, l'application se met à jour toute seule : elle vous propose la nouvelle version au démarrage dès qu'elle est disponible.",
    },
    create: {
      title: 'Créer son numéro',
      intro:
        "L'écran d'accueil sépare deux univers : « SPECTACLE » en haut, « NUMÉRO » en bas. En tant qu'artiste, c'est la partie du bas qui vous concerne — le spectacle complet est l'affaire du régisseur, qui assemblera les numéros de tout le plateau.",
      button:
        "Cliquez sur « Nouveau numéro ». L'application vous demande un « Nom du numéro » et un « Dossier du numéro ». Par la suite, « Ouvrir un numéro » vous ramènera dessus.",
      folder:
        "Le dossier choisi contiendra tout : la description de votre numéro et les fichiers audio, copiés à l'intérieur. Il reste donc déplaçable d'un ordinateur à l'autre sans rien casser.",
      autosave:
        "Il n'y a pas de bouton « Enregistrer » : tout est sauvegardé au fur et à mesure. Un historique d'annulation de 50 niveaux rattrape les fausses manœuvres.",
    },
    steps: {
      title: 'Construire le déroulé',
      intro:
        "Un numéro est une suite d'étapes jouées dans l'ordre : des musiques et des pauses. Le bouton « Ajouter une étape » propose « Musique » ou « Pause », et l'ordre se réorganise au glisser-déposer.",
      sources: {
        title: 'Trois façons d’ajouter une musique',
      },
      computer: {
        label: 'Cet ordinateur',
        desc: 'un fichier audio déjà présent sur votre disque.',
      },
      url: {
        label: 'Depuis une URL',
        desc: "l'adresse directe d'un fichier audio en ligne.",
      },
      youtube: {
        label: 'YouTube',
        desc: "le lien d'une vidéo, dont seul l'audio est extrait. L'outil nécessaire est inclus dans l'application, rien à installer à côté.",
      },
      copied:
        "Dans les trois cas, le fichier est copié dans le dossier de votre numéro. Supprimer ou déplacer l'original plus tard ne cassera rien.",
      pause: {
        title: 'Les pauses',
        content:
          "Une pause avec une durée enchaîne automatiquement au bout du délai — pratique pour un silence calibré au milieu du numéro. Une pause laissée sans durée attend une action du régisseur : c'est ce qu'il faut choisir quand le redémarrage dépend de vous, d'un applaudissement ou d'un imprévu.",
      },
    },
    settings: {
      title: 'Régler chaque musique',
      intro:
        "Le volume se règle directement sur la ligne de la piste, avec le curseur affiché à côté de son nom. Le reste se trouve derrière l'icône d'engrenage de la piste, qui ouvre ses paramètres — et rien de tout cela ne modifie le fichier d'origine :",
      trim: {
        label: 'Début et fin',
        desc: "pour ne jouer qu'un extrait. Deux façons de faire, au choix : saisir les valeurs dans les champs (« 0:30 » ou « 30»), ou attraper directement la zone colorée sur la forme d'onde et la déplacer ou l'étirer. Les deux restent synchronisés.",
      },
      fades: {
        label: 'Fade in et fade out',
        desc: 'une durée en secondes pour monter ou descendre le son progressivement, au lieu d’une coupure sèche.',
      },
      preview: {
        label: 'Écoute',
        desc: "le bouton de lecture au-dessus de la forme d'onde fait entendre le résultat, extrait et fondus compris, avant de valider.",
      },
      cueTitle: 'Le « Top de départ », votre message au régisseur',
      cueText:
        "Chaque étape accepte une note libre, affichée au régisseur pendant la représentation. C'est là que se joue la précision de votre numéro : écrivez ce sur quoi il doit lancer la piste — « au premier lancer de massues », « quand je suis en place sur le fil ». Une piste sans top de départ oblige le régisseur à deviner.",
    },
    check: {
      title: 'Vérifier avant d’envoyer',
      intro:
        "L'icône de bouclier, en haut de l'éditeur, contrôle en un clic ce qui casse une représentation. La fenêtre s'intitule « Vérification du spectacle » même pour un numéro seul — ne vous laissez pas dérouter. Prenez l'habitude de la lancer avant d'exporter, elle repère notamment :",
      missing: 'un fichier audio manquant ou déplacé',
      order: 'un point de début placé après le point de fin',
      fades: "des fondus cumulés plus longs que l'extrait à jouer",
      volume: 'une piste laissée à un volume de 0',
    },
    export: {
      title: 'Exporter pour le régisseur',
      intro:
        'Deux façons de transmettre votre numéro, selon que vous préférez envoyer un fichier ou un code.',
      file: {
        title: 'En fichier',
        content:
          "L'icône de partage, en haut de l'éditeur, ouvre la fenêtre « Exporter le numéro ». La première option, « Exporter en fichier .regiesonnumero », enregistre une archive contenant à la fois le déroulé et toutes vos musiques, avec vos réglages. C'est le format à joindre à un mail ou à déposer sur une clé USB.",
      },
      cloud: {
        title: 'En ligne',
        content:
          '« Partager sur le cloud » téléverse la même archive et vous renvoie un code court à transmettre au régisseur. Aucun compte, aucune inscription — ni pour vous, ni pour lui.',
      },
      expiryTitle: 'Le partage en ligne expire au bout de 72 heures',
      expiryText:
        "C'est fait pour dépanner, pas pour archiver. Si votre passage est dans deux semaines, envoyez plutôt le fichier — ou refaites un partage la veille.",
    },
    regisseur: {
      title: 'Ce que le régisseur en fait',
      intro:
        'De son côté, la manipulation est immédiate. Cela vaut la peine de le savoir : cela vous permet de répondre à ses questions.',
      open: "Un double-clic sur le fichier « .regiesonnumero » l'importe directement dans son application.",
      integrate:
        "Il peut aussi l'intégrer à son spectacle complet, où votre numéro prendra place parmi les autres. Vos réglages — volume, extraits, fondus, tops de départ — sont conservés tels quels.",
      autonomous:
        "Vos musiques voyagent avec le fichier : il n'a rien à vous redemander, et rien ne dépend d'un lien qui pourrait expirer.",
    },
  },
}

const t = (path: string): string =>
  path.split('.').reduce<any>((value, key) => value?.[key], messages) ?? path

definePageMeta({ layout: 'guide', title: 'Guide - Régie Son' })

useHead({
  title: 'Guide Régie Son | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide artiste pour Régie Son : installer l’application, créer son numéro, régler ses musiques et l’exporter pour le régisseur.',
    },
  ],
})

const RELEASE = 'https://github.com/powange/regie-son/releases/latest/download'

const downloads = [
  {
    os: 'Windows',
    links: [
      { label: 'Installeur .exe', href: `${RELEASE}/Regie.Son_x64-setup.exe` },
      { label: '.msi', href: `${RELEASE}/Regie.Son_x64_en-US.msi` },
    ],
  },
  {
    os: 'macOS (puce Apple)',
    links: [{ label: '.dmg', href: `${RELEASE}/Regie.Son_aarch64.dmg` }],
  },
  {
    os: 'macOS (Intel)',
    links: [{ label: '.dmg', href: `${RELEASE}/Regie.Son_x64.dmg` }],
  },
  {
    os: 'Linux',
    links: [
      { label: '.AppImage', href: `${RELEASE}/Regie.Son_amd64.AppImage` },
      { label: '.deb', href: `${RELEASE}/Regie.Son_amd64.deb` },
    ],
  },
]

const createSteps = computed(() => [
  t('sections.create.button'),
  t('sections.create.folder'),
  t('sections.create.autosave'),
])

const audioSources = computed(() =>
  ['computer', 'url', 'youtube'].map((key) => ({
    label: t(`sections.steps.${key}.label`),
    desc: t(`sections.steps.${key}.desc`),
  }))
)

const trackSettings = computed(() =>
  ['trim', 'fades', 'preview'].map((key) => ({
    label: t(`sections.settings.${key}.label`),
    desc: t(`sections.settings.${key}.desc`),
  }))
)

const checkItems = computed(() => [
  t('sections.check.missing'),
  t('sections.check.order'),
  t('sections.check.fades'),
  t('sections.check.volume'),
])

const regisseurItems = computed(() => [
  t('sections.regisseur.open'),
  t('sections.regisseur.integrate'),
  t('sections.regisseur.autonomous'),
])
</script>
