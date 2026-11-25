export default defineAppConfig({
  // Flowvent n'offre que la gestion interne des bénévoles : son objet est l'outil lui-même.
  benevoles: { modeExterne: false },
  ui: {
    colors: {
      primary: 'flow', // orange de marque #FF6A00 (défini dans main.css)
      secondary: 'flowteal', // accent teal #0FD5BB
      neutral: 'stone', // graphite chaud
    },
  },
})
