export default defineAppConfig({
  ui: {
    // Panneau d'options ajusté à son contenu, pour tous les sélecteurs du projet — il en compte
    // cent quarante-quatre, dont seize seulement portaient ce réglage à la main. L'espace artiste
    // et la modale d'artiste, qui affichent pourtant les mêmes champs, divergeaient pour cette
    // raison.
    select: {
      slots: { content: 'min-w-fit' },
    },
    selectMenu: {
      slots: { content: 'min-w-fit' },
    },
  },
})
