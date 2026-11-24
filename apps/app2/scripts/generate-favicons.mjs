#!/usr/bin/env node
/**
 * Génère les favicons et icônes PWA de Flowvent (`npm run favicons`, depuis apps/app2).
 *
 * Le générateur est COMMUN aux apps du dépôt : `scripts/favicons/generer-favicons.mjs`. Ce fichier
 * n'en porte que la configuration propre à Flowvent.
 *
 * Source : le logo maître `app/assets/flowvent_v2_logo.svg`. Ses ailes noires passent en blanc,
 * sur le graphite de la marque ; la feuille reste orange. L'icône d'onglet vectorielle,
 * `public/favicon.svg`, est à part : elle suit le mode sombre du navigateur, ce qu'un PNG ne peut pas.
 */
import path from 'node:path'

import pngToIco from 'png-to-ico'
import sharp from 'sharp'

import { genererFavicons } from '../../../scripts/favicons/generer-favicons.mjs'

genererFavicons({
  sharp,
  pngToIco,
  source: path.resolve('app/assets/flowvent_v2_logo.svg'),
  dossierPublic: path.resolve('public'),
  remplacements: [['fill="#000000"', 'fill="#ffffff"']],
  // stone-900, le graphite de la palette neutre (app.config.ts → neutral: 'stone')
  fond: { r: 28, g: 25, b: 23 },
  // Le logo n'est pas carré (277,75 × 289,5) : contenu plutôt que recadré, avec une marge.
  echelle: 0.8,
  // Seul le disque central de 80 % est garanti visible sur Android.
  maskable: { echelle: 0.6 },
}).catch((e) => {
  console.error(e)
  process.exit(1)
})
