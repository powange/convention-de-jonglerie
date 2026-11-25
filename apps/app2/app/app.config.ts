export default defineAppConfig({
  // Bénévoles : Flowvent n'offre que la gestion interne (son objet est l'outil lui-même), et n'a
  // ni billetterie, ni organisateurs déclarés, ni messagerie — ce qui en dépend est masqué.
  benevoles: { modeExterne: false, billetterie: false, organisateurs: false, messagerie: false },
  ui: {
    colors: {
      primary: 'flow', // orange de marque #FF6A00 (défini dans main.css)
      secondary: 'flowteal', // accent teal #0FD5BB
      neutral: 'stone', // graphite chaud
    },
  },
})
