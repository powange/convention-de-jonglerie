#!/usr/bin/env tsx
/* eslint-disable import/order */
/**
 * Génère les favicons et icônes PWA d'app1 (`npm run favicons`, depuis apps/app1).
 *
 * Le générateur est COMMUN aux apps du dépôt : `scripts/favicons/generer-favicons.mjs`. Ce fichier
 * n'en porte que la configuration propre à Juggling Convention.
 *
 * ⚠️ L'icône `android-chrome-maskable-512x512.png` N'EST PAS régénérée ici : elle a été faite à la
 * main pour la publication Play Store (#638, cf. docs/publication-play-store-twa.md). Le générateur
 * sait la produire (`maskable: { echelle }`), mais remplacer une icône déjà publiée doit rester une
 * décision explicite. Le manifeste web est généré dynamiquement : server/api/site.webmanifest.get.ts.
 */
import path from 'node:path'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

import { genererFavicons } from '../../../scripts/favicons/generer-favicons.mjs'

genererFavicons({
  sharp,
  pngToIco,
  source: path.resolve('public/logos/logo-jc.svg'),
  dossierPublic: path.resolve('public'),
  // Les zones noires du logo passent en blanc, sur le fond sombre de la marque.
  remplacements: [['fill="rgb(5,12,10)"', 'fill="#ffffff"']],
  // oklch(20.8% 0.042 265.755) converti en RGB
  fond: { r: 15, g: 23, b: 43 },
  badge: { source: path.resolve('public/favicons/notification-badge.svg'), taille: 96 },
}).catch((e) => {
  console.error(e)
  process.exit(1)
})
