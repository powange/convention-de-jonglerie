#!/usr/bin/env node
/**
 * Garde-fou de typage sur les seuls fichiers modifiés.
 *
 * Le typage complet remonte des milliers d'erreurs préexistantes : faire échouer la CI dessus la
 * rendrait rouge en permanence, et c'est pourquoi le garde-fou d'origine se limitait aux noms non
 * définis. L'angle mort a coûté cher — un `TS2345` (objet passé là où un entier est attendu) a
 * atteint la production et renvoyé sept erreurs 500 à un utilisateur qui tentait de modifier son
 * atelier, alors que `nuxt typecheck` le signalait déjà.
 *
 * On gèle donc la dette au lieu de la solder : les erreurs des fichiers que la branche touche
 * bloquent, celles du reste du dépôt attendent leur tour.
 */

/**
 * Le journal a-t-il été écrit JUSQU'AU BOUT ?
 *
 * ⚠️ Sans cette question, toutes les portes ci-dessous rendent un vert sur un journal mort. C'est
 * arrivé, et pendant des semaines : l'étape faisait `npm run typecheck > typecheck.log 2>&1
 * || true`, `vue-tsc` mourait en rupture de mémoire vers 115 s au plafond de tas par défaut de
 * 4 Go, et le journal ne contenait AUCUNE ligne `error TS`. Les portes cherchaient donc un motif
 * dans un fichier vide, ne le trouvaient pas, et concluaient « ✅ aucune erreur » — job `success`.
 * Mesuré sur les cinq derniers passages de `main` : 1 855 à 1 906 octets, zéro `error TS`,
 * `FATAL ERROR` dans les cinq.
 *
 * 📍 Le `|| true` annulait la garde qu'il était censé protéger : il transformait un plantage en
 * succès silencieux, et rendait un OOM indiscernable d'un dépôt propre.
 *
 * ⚠️ Et cette fonction ne doit SURTOUT PAS se prouver par la présence d'erreurs. Un journal
 * complet sur un dépôt sain n'en contient aucune : une garde qui exigerait d'en voir tomberait
 * le jour où la dette atteindrait zéro — c'est-à-dire au seul moment où elle serait inutile.
 * Elle cherche donc des traces de PLANTAGE, et traite « des erreurs de type » comme un
 * aboutissement normal.
 *
 * @param {string} journal - sortie brute de `nuxt typecheck`
 * @param {number} codeSortie - code de sortie du processus
 * @returns {{ abouti: boolean, raison: string }}
 */
export function diagnostiquerAboutissement(journal, codeSortie) {
  // Les marques que Node laisse en mourant. Elles sont dans le journal, pas dans le code de sortie.
  const plantages = [
    [/JavaScript heap out of memory/, 'rupture de mémoire (tas JavaScript saturé)'],
    [/Ineffective mark-compacts near heap limit/, 'rupture de mémoire (plafond de tas atteint)'],
    [/FATAL ERROR:/, 'erreur fatale de Node'],
    [/Allocation failed/, 'échec d’allocation mémoire'],
    [/Segmentation fault|SIGSEGV/, 'défaut de segmentation'],
    [/----- Native stack trace -----/, 'trace native : le processus a été interrompu'],
  ]

  for (const [motif, raison] of plantages) {
    if (motif.test(journal)) return { abouti: false, raison }
  }

  // Tué par un signal : 128 + n. L'OOM de Node rend 134 (SIGABRT), un `kill` en rend 137.
  if (codeSortie >= 128) {
    return { abouti: false, raison: `processus tué par le signal ${codeSortie - 128}` }
  }

  // 0 = rien à signaler ; 1 et 2 = des erreurs de type, ce qui est un passage ABOUTI.
  return { abouti: true, raison: `typage mené à terme (code ${codeSortie})` }
}

/** Le journal cite les chemins depuis `apps/app1` ; git les donne depuis la racine. */
export function normaliserChemin(chemin) {
  return chemin.startsWith('../../') ? chemin.slice('../../'.length) : `apps/app1/${chemin}`
}

/**
 * Les erreurs du journal, regroupées par (fichier, code, message) avec leur NOMBRE.
 *
 * Trois décisions dans cette clé, chacune payée par une mesure :
 *
 * - **Pas le numéro de ligne.** Il bouge au moindre ajout au-dessus, et une liste de référence
 *   calée dessus deviendrait fausse à la première retouche du fichier, sans qu'aucune erreur
 *   n'ait été ni créée ni corrigée.
 * - **Mais le NOMBRE**, car `fichier + message` ne suffit pas : mesuré sur le journal réel,
 *   `stock/missing.vue` porte **dix** erreurs au message identique — dix colonnes de tableau.
 *   Sans le compte, en corriger une laisserait la liste satisfaite et les neuf autres invisibles.
 * - **Dédoublonné sur la ligne exacte d'abord**, parce que `nuxt typecheck` répète chaque erreur
 *   à l'identique : 166 lignes pour 132 erreurs réelles dans le journal de référence. Compter le
 *   brut gonflerait chaque entrée.
 *
 * @param {string} journal - sortie brute de `nuxt typecheck`
 * @param {string[]} codes - codes TS retenus (sans le préfixe « TS »)
 * @returns {Map<string, number>} clé `chemin\tTSxxxx\tmessage` → nombre d'erreurs
 */
export function compterErreurs(journal, codes) {
  const motif = /^(\S+?)\((\d+),(\d+)\): error TS(\d+): (.*)$/
  const lignesVues = new Set()
  const comptes = new Map()

  for (const brute of journal.split('\n')) {
    const ligne = brute.trim()
    const m = motif.exec(ligne)
    if (!m || !codes.includes(m[4])) continue
    if (lignesVues.has(ligne)) continue // la même erreur, répétée telle quelle
    lignesVues.add(ligne)

    const cle = `${normaliserChemin(m[1])}\tTS${m[4]}\t${m[5]}`
    comptes.set(cle, (comptes.get(cle) || 0) + 1)
  }

  return comptes
}

/** Le fichier de référence, prêt à écrire : une ligne par entrée, trié pour un diff lisible. */
export function serialiserDette(comptes) {
  return [...comptes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cle, n]) => `${n}\t${cle}`)
    .join('\n')
}

/** L'inverse : relire le fichier de référence, en ignorant commentaires et lignes vides. */
export function lireDette(contenu) {
  const comptes = new Map()
  for (const ligne of contenu.split('\n')) {
    if (!ligne.trim() || ligne.startsWith('#')) continue
    const sep = ligne.indexOf('\t')
    if (sep === -1) continue
    comptes.set(ligne.slice(sep + 1), Number(ligne.slice(0, sep)))
  }
  return comptes
}

/**
 * Comparer le journal à la dette gelée.
 *
 * ⚠️ Deux verdicts, et le second est celui qui fait descendre le compteur.
 *
 * - `nouvelles` : une erreur absente de la liste, ou plus nombreuse qu'elle ne l'annonce. C'est
 *   une régression, et c'est ce que la porte doit empêcher — un `TS2345` a déjà atteint la
 *   production et renvoyé sept erreurs 500.
 * - `perimees` : une entrée de la liste qui ne correspond plus à rien, parce que l'erreur a été
 *   corrigée. **Elle fait échouer la porte aussi**, à dessein : sans cela, la liste ne diminuerait
 *   jamais et finirait par décrire un dépôt qui n'existe plus. On la retire, et le compteur baisse.
 *   Le message nomme la commande qui régénère le fichier, donc le geste coûte dix secondes.
 *
 * 📍 Cette garde ne se prouve PAS par la présence d'erreurs : une liste vide face à un journal
 * sans erreur rend « rien à signaler », et c'est le cas final recherché, pas une panne.
 *
 * @returns {{ nouvelles: string[], perimees: string[], gelees: number }}
 */
export function comparerALaDette(journal, contenuDette, codes) {
  const actuel = compterErreurs(journal, codes)
  const gelee = lireDette(contenuDette)
  const nouvelles = []
  const perimees = []

  for (const [cle, n] of actuel) {
    const attendu = gelee.get(cle) || 0
    if (n > attendu) {
      const [chemin, code, message] = cle.split('\t')
      nouvelles.push(
        attendu === 0
          ? `${chemin} — ${code}: ${message}`
          : `${chemin} — ${code} × ${n} au lieu de ${attendu} : ${message}`
      )
    }
  }

  for (const [cle, attendu] of gelee) {
    const n = actuel.get(cle) || 0
    if (n < attendu) {
      const [chemin, code, message] = cle.split('\t')
      perimees.push(
        `${attendu - n} entrée(s) à retirer — ${chemin} — ${code}: ${message.slice(0, 90)}`
      )
    }
  }

  let gelees = 0
  for (const n of gelee.values()) gelees += n

  return { nouvelles: nouvelles.sort(), perimees: perimees.sort(), gelees }
}

// ── Ligne de commande ──────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync, writeFileSync } = await import('node:fs')
  const [mode, journalArg, deuxieme, codesArg] = process.argv.slice(2)

  const usage = () => {
    console.error('usage :')
    console.error('  typecheck-gate.mjs --aboutissement <journal> <code de sortie>')
    console.error('  typecheck-gate.mjs --dette         <journal> <fichier de dette> [codes]')
    console.error('  typecheck-gate.mjs --figer         <journal> <fichier de dette> [codes]')
    process.exit(2)
  }
  if (!mode || !journalArg) usage()

  // ── Le journal est-il complet ? À passer AVANT toute porte qui le lit.
  if (mode === '--aboutissement') {
    if (deuxieme === undefined) usage()
    const { abouti, raison } = diagnostiquerAboutissement(
      readFileSync(journalArg, 'utf8'),
      Number(deuxieme)
    )
    if (!abouti) {
      console.error(`::error::Le typage n'a PAS abouti : ${raison}.`)
      console.error(
        'Toute porte qui lit ce journal rendrait un faux vert : un journal mort ne contient aucune'
      )
      console.error('ligne `error TS`, ce qui se lit comme un dépôt propre. Corriger la cause.')
      process.exit(1)
    }
    console.log(`✅ ${raison}. Le journal peut servir de base aux portes.`)
    process.exit(0)
  }

  const codes = (codesArg || '2345')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)

  // ── Régénérer la liste de dette depuis un journal de CI.
  if (mode === '--figer') {
    if (!deuxieme) usage()
    const comptes = compterErreurs(readFileSync(journalArg, 'utf8'), codes)
    let total = 0
    for (const n of comptes.values()) total += n
    const entete = [
      `# Dette de typage GELÉE — TS${codes.join('/TS')}`,
      '#',
      '# Ce fichier existe pour que la porte ne bloque que les erreurs NOUVELLES. Sans lui, elle',
      '# bloquait sur les erreurs préexistantes de tout fichier qu’une branche touche : mesuré sur',
      "# les 120 derniers commits, 15 d'entre eux (1 sur 8) auraient été refusés pour une dette",
      "# qu'ils n'avaient pas écrite — dont une PR dont le diff ne passait même pas près de la ligne.",
      '#',
      '# ⚠️ CE COMPTEUR DOIT DESCENDRE. Corriger une erreur rend son entrée périmée, et la porte',
      '# échoue tant qu’on ne l’a pas retirée — à dessein : une liste qu’on ne nettoie pas finit par',
      "# décrire un dépôt qui n'existe plus. Pour la régénérer après correction :",
      '#',
      '#   node scripts/typecheck-gate.mjs --figer <journal> typecheck-dette-2345.txt',
      '#',
      '# Le journal se récupère en artefact `typecheck-log` de n’importe quel passage de CI : la',
      '# mesure doit venir de LÀ, un poste de développement résolvant les paquets autrement (voir',
      '# le commentaire du job `typecheck` dans .github/workflows/tests.yml).',
      '#',
      '# Clé : <nombre>\\t<chemin>\\tTS<code>\\t<message>. Pas de numéro de ligne, il bouge pour rien.',
      `# Total gelé : ${total} erreur(s) sur ${comptes.size} entrée(s).`,
      '',
    ].join('\n')
    writeFileSync(deuxieme, `${entete}${serialiserDette(comptes)}\n`)
    console.log(`✅ ${total} erreur(s) gelée(s) sur ${comptes.size} entrée(s) → ${deuxieme}`)
    process.exit(0)
  }

  // ── La porte : seules les erreurs absentes de la liste bloquent.
  if (mode === '--dette') {
    if (!deuxieme) usage()
    const { nouvelles, perimees, gelees } = comparerALaDette(
      readFileSync(journalArg, 'utf8'),
      readFileSync(deuxieme, 'utf8'),
      codes
    )

    if (nouvelles.length > 0) {
      console.error(`::error::${nouvelles.length} erreur(s) TS${codes.join('/TS')} NOUVELLE(S) :`)
      for (const l of nouvelles) console.error(`  ${l}`)
      console.error('')
      console.error(
        'Ces erreurs ne sont pas dans la dette gelée : elles viennent de cette branche.'
      )
      console.error('Les corriger. Ne PAS les ajouter à la liste pour faire passer la porte.')
      process.exit(1)
    }

    if (perimees.length > 0) {
      console.error(`::error::${perimees.length} entrée(s) de dette PÉRIMÉE(S) — à retirer :`)
      for (const l of perimees) console.error(`  ${l}`)
      console.error('')
      console.error('Bonne nouvelle : ces erreurs sont corrigées. Il reste à faire baisser le')
      console.error('compteur, sans quoi la liste décrirait un dépôt qui n’existe plus :')
      console.error(`  node scripts/typecheck-gate.mjs --figer ${journalArg} ${deuxieme}`)
      process.exit(1)
    }

    console.log(`✅ Aucune erreur TS${codes.join('/TS')} nouvelle. Dette gelée : ${gelees}.`)
    process.exit(0)
  }

  usage()
}
