export default defineAppConfig({
  ui: {
    primary: 'violet',
    gray: 'cool',
    card: {
      background: 'bg-white dark:bg-gray-800',
      border: 'border border-gray-200 dark:border-violet-600/30',
      shadow: 'shadow-sm dark:shadow-lg dark:shadow-violet-500/10',
      body: {
        background: 'bg-white dark:bg-gray-800',
      },
      header: {
        background: 'bg-gray-50 dark:bg-gray-700',
      },
    },
    button: {
      default: {
        color: 'neutral',
        loadingIcon: 'i-heroicons-arrow-path-20-solid',
      },
      variant: {
        solid: 'shadow-sm dark:shadow-violet-500/20',
        ghost: 'dark:hover:bg-violet-500/10',
      },
    },
    badge: {
      variant: {
        solid: 'dark:shadow-sm dark:shadow-violet-500/20',
      },
    },
    modal: {
      background: 'bg-white dark:bg-gray-800',
      border: 'border border-gray-200 dark:border-violet-600/30',
      overlay: {
        background: 'bg-gray-200/75 dark:bg-gray-950/95',
      },
    },
    dropdown: {
      background: 'bg-white dark:bg-gray-700',
      border: 'border border-gray-200 dark:border-violet-600/30',
      item: {
        active: 'bg-gray-100 dark:bg-violet-500/20',
      },
    },
    input: {
      background: 'bg-white dark:bg-gray-700',
      border: 'border border-gray-300 dark:border-violet-600/40',
      color: {
        gray: {
          outline:
            'shadow-sm dark:shadow-violet-500/10 focus:ring-2 focus:ring-primary-500 dark:focus:ring-violet-500',
        },
      },
    },
    // Panneau d'options ajusté à son contenu, pour tous les sélecteurs du projet — qui en compte
    // cent quarante-quatre, dont seize seulement portaient ce réglage à la main.
    //
    // Ces deux clés suivent la syntaxe de Nuxt UI 4. Le reste de ce fichier est resté en syntaxe
    // v2 — « background », « border », « primary »… — et n'a donc plus aucun effet. Sa reprise
    // change l'apparence de nombreux écrans et mérite d'être traitée à part.
    //
    // À CONFIRMER : l'effet de ces deux clés n'a pas pu être vérifié en développement, où une
    // modification de ce fichier ne semble pas reprise sans redémarrage du serveur. Le réglage
    // posé sur chaque champ reste donc en place, lui vérifié.
    select: {
      slots: { content: 'min-w-fit' },
      background: 'bg-white dark:bg-gray-700',
      border: 'border border-gray-300 dark:border-violet-600/40',
    },
    selectMenu: {
      slots: { content: 'min-w-fit' },
    },
    textarea: {
      background: 'bg-white dark:bg-gray-700',
      border: 'border border-gray-300 dark:border-violet-600/40',
    },
    toast: {
      background: 'bg-white dark:bg-[#1A1F4A]',
      border: 'border border-gray-200 dark:border-indigo-600/30',
      shadow: 'shadow-lg dark:shadow-violet-500/20',
    },
    notification: {
      background: 'bg-white dark:bg-[#1A1F4A]',
      border: 'border border-gray-200 dark:border-indigo-600/30',
    },
    slideover: {
      background: 'bg-white dark:bg-[#141837]',
      overlay: {
        background: 'bg-gray-200/75 dark:bg-[#0A0E27]/95',
      },
    },
    table: {
      td: {
        color: 'text-gray-900 dark:text-violet-100',
      },
      th: {
        color: 'text-gray-900 dark:text-violet-200',
      },
    },
  },
})
