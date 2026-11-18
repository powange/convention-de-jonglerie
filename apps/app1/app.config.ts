export default defineAppConfig({
  ui: {
    /*
     * ⚠️ CE FICHIER NE CONTIENT PLUS QUE DES CLÉS EN SYNTAXE NUXT UI 4.
     *
     * Il portait auparavant une trentaine de clés en syntaxe v2 — `primary`, `gray`, et des blocs
     * `card`, `button`, `badge`, `modal`, `dropdown`, `input`, `textarea`, `toast`, `notification`,
     * `slideover`, `table` faits de `background` / `border` / `variant` / `item` / `color`. Nuxt UI
     * 4 les ignore toutes : elles décrivaient une apparence que l'application n'avait pas.
     *
     * 📍 MESURÉ AVANT DE SUPPRIMER, variables CSS et capture d'écran à l'appui : `--ui-primary`
     * vaut exactement `--color-green-500` (`oklch(72.3% 0.219 149.579)`). Autrement dit, le
     * fichier annonçait `primary: 'violet'` et l'application rendait du VERT — onglet actif, cases
     * cochées, pastilles. Retirer ces clés ne change donc RIEN à l'écran, ce qui a été vérifié par
     * comparaison avant/après.
     *
     * ⚠️ La couleur d'accent reste le vert. En changer est un choix d'identité visuelle, pas un
     * nettoyage : il se fera par `ui: { colors: { primary: '…' } }`, délibérément, et touchera tous
     * les écrans d'un coup.
     *
     * ⚠️ Le thème sombre « Midnight Circus », lui, N'EST PAS mort : il vit dans
     * `app/assets/css/main.css` et s'applique bien — le fond bleu nuit est rendu. Ne pas le
     * « corriger » sur la foi du format de ses valeurs.
     *
     * Panneau d'options ajusté à son contenu, pour les cent quarante-quatre sélecteurs du projet.
     */
    select: {
      slots: { content: 'min-w-fit' },
    },
    selectMenu: {
      slots: { content: 'min-w-fit' },
    },
  },
})
