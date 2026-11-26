export default defineAppConfig({
  // Bénévoles : Flowvent n'offre que la gestion interne (son objet est l'outil lui-même), et n'a pas
  // de messagerie. La billetterie (lot 6) et les organisateurs déclarés y existent désormais : le
  // statut du billet des bénévoles et les organisateurs dans les équipes sont ouverts (décision du
  // 26/11/2026).
  benevoles: { modeExterne: false, billetterie: true, organisateurs: true, messagerie: false },
  // Billetterie : HelloAsso seul (décision du 25/11/2026), ni Infomaniak ni SumUp ; le logo d'un
  // billet vendu sur place est celui de Flowvent.
  billetterie: { infomaniak: false, sumup: false, logoDuSite: '/favicon.svg' },
  ui: {
    colors: {
      primary: 'flow', // orange de marque #FF6A00 (défini dans main.css)
      secondary: 'flowteal', // accent teal #0FD5BB
      neutral: 'stone', // graphite chaud
    },
  },
})
