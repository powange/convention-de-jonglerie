// Layer « ui » — mécanismes d'interface qui ne relèvent d'aucun métier.
//
// Il n'y a rien ici qui parle de conventions, de bénévoles ou de matériel : ce layer n'existe que
// pour ce qu'une seconde application reprendrait tel quel. C'est aussi ce qui le distingue des
// autres layers, tous rattachés à un domaine — et la règle qui décide de ce qu'on y met : si
// l'explication d'un fichier a besoin du mot « édition », il n'a rien à y faire.
//
// Occupants : les pastilles de compteur du menu de navigation, puis les composants `Ui*` génériques
// (avatar, nom d'utilisateur, confirmations, sélecteurs de date et de couleur, téléphone…) dont le
// layer bénévoles se sert, avec leurs composables et utilitaires. Ils vivaient dans app1 ; Flowvent
// (app2) doit les recevoir sans la recopier. Alias `#ui-commun` pour les imports explicites.
import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  // Feuilles communes : la mise en forme du Markdown rendu (`prose`) et l'habillage de FullCalendar.
  // Sans elles, Flowvent affichait la description de la page bénévole en texte brut (ni titres ni
  // puces) et ses plannings aux couleurs par défaut de FullCalendar.
  css: [
    fileURLToPath(new URL('./app/assets/css/prose.css', import.meta.url)),
    fileURLToPath(new URL('./app/assets/css/fullcalendar.css', import.meta.url)),
  ],
  alias: {
    // Pas `#ui` : Nuxt UI s'en sert déjà (`#ui/types`, `#ui/components/…`).
    '#ui-commun': fileURLToPath(new URL('./', import.meta.url)),
  },
})
