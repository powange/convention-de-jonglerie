import { describe, it, expect } from 'vitest'

// @ts-expect-error — module .mjs sans déclarations, importé pour son comportement
import {
  comparerALaDette,
  compterErreurs,
  diagnostiquerAboutissement,
  lireDette,
  normaliserChemin,
  serialiserDette,
} from '../../../scripts/typecheck-gate.mjs'

/**
 * Le garde-fou n'a de valeur que s'il attrape l'erreur qui a atteint la production, et seulement
 * sur les fichiers que la branche touche. D'où le vrai message de `nuxt typecheck` en exemple,
 * plutôt qu'une ligne inventée qui pourrait ne rien avoir en commun avec la sortie réelle.
 */
const LIGNE_REELLE =
  "../../layers/workshops/server/api/editions/[id]/workshops/[workshopId].put.ts(24,7): error TS2345: Argument of type '{ id: number; editionId: number; }' is not assignable to parameter of type 'number'."
const FICHIER_REEL = 'layers/workshops/server/api/editions/[id]/workshops/[workshopId].put.ts'

/**
 * Le journal réellement produit par la CI pendant des semaines : 1 891 octets, aucune ligne
 * `error TS`, et un plantage mémoire au milieu. Recopié de l'artefact `typecheck-log` du passage
 * 39060512481 sur `main` plutôt que réécrit, pour que le test porte sur la vraie sortie.
 */
const JOURNAL_OOM_REEL = `
> typecheck
> nuxt typecheck

[warn] [nuxt-site-config] [Nuxt Site Config] Invalid config provided, please correct:

<--- Last few GCs --->

[2211:0x259f4000]   114567 ms: Scavenge 4076.9 (4099.7) -> 4072.1 (4117.2) MB, pooled: 0 MB
[2211:0x259f4000]   115955 ms: Mark-Compact (reduce) 4086.1 (4117.5) -> 4070.0 (4090.2) MB

FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [node]
`

describe('Le journal de typage doit être complet avant qu’une porte le lise', () => {
  it('attrape le VRAI journal d’OOM qui a rendu la porte vacante', () => {
    const { abouti, raison } = diagnostiquerAboutissement(JOURNAL_OOM_REEL, 134)

    expect(abouti).toBe(false)
    expect(raison).toMatch(/mémoire/)
  })

  it('⚠️ et l’attrape même si le code de sortie prétend que tout va bien', () => {
    // C'est exactement ce que faisait le `|| true` de l'étape : il forçait 0.
    expect(diagnostiquerAboutissement(JOURNAL_OOM_REEL, 0).abouti).toBe(false)
  })

  it('laisse passer un journal abouti QUI CONTIENT des erreurs de type', () => {
    // Des milliers d'erreurs préexistantes : leur présence est normale, ce n'est pas un plantage.
    const journal = `${LIGNE_REELLE}\nFound 1 error in 1 file.`

    expect(diagnostiquerAboutissement(journal, 2).abouti).toBe(true)
  })

  it('📍 et laisse passer un journal abouti SANS aucune erreur', () => {
    /*
     * Le cas qui compte pour la durée de vie de cette garde. Si elle se prouvait par la présence
     * d'erreurs, elle tomberait le jour où la dette atteindrait zéro — au seul moment où elle
     * n'aurait plus rien à dire. Elle cherche donc des traces de plantage, pas des erreurs.
     */
    expect(diagnostiquerAboutissement('> typecheck\n> nuxt typecheck\n', 0).abouti).toBe(true)
  })

  it('attrape un processus tué par un signal, journal muet compris', () => {
    // Un `kill -9` ne laisse rien dans le journal : seul le code de sortie le dit.
    expect(diagnostiquerAboutissement('', 137).abouti).toBe(false)
    expect(diagnostiquerAboutissement('', 137).raison).toMatch(/signal 9/)
  })
})

describe('Chemins', () => {
  it('rend les chemins du journal comparables à ceux de git', () => {
    // Le journal cite depuis `apps/app1` ; git et la liste de dette, depuis la racine.
    expect(normaliserChemin('../../layers/a/b.ts')).toBe('layers/a/b.ts')
    expect(normaliserChemin('server/api/c.ts')).toBe('apps/app1/server/api/c.ts')
  })
})

/**
 * Deux vraies lignes du journal de CI, et elles ne sont pas choisies au hasard : `EditionsGrid`
 * porte NEUF erreurs au message identique à des lignes différentes. C'est ce cas qui impose de
 * compter, plutôt que de se contenter de la paire (fichier, message).
 */
const GRILLE =
  "app/components/convention/EditionsGrid.vue(%L%,36): error TS2345: Argument of type 'Edition' is not assignable to parameter of type 'DashboardEdition'."
const journalGrille = (lignes: number[]) =>
  lignes.map((l) => GRILLE.replace('%L%', String(l))).join('\n')

describe('Compter les erreurs pour les geler', () => {
  it('regroupe par (fichier, code, message) et compte', () => {
    const comptes = compterErreurs(journalGrille([10, 20, 30]), ['2345'])

    expect(comptes.size).toBe(1)
    expect([...comptes.values()][0]).toBe(3)
  })

  it('⚠️ ignore les répétitions à l’identique que `nuxt typecheck` produit', () => {
    // Le journal réel comptait 166 lignes pour 132 erreurs : compter le brut gonflerait la dette.
    const avecDoublons = `${journalGrille([10, 20])}\n${journalGrille([10, 20])}`

    expect([...compterErreurs(avecDoublons, ['2345']).values()][0]).toBe(2)
  })

  it('📍 la clé ne contient PAS le numéro de ligne', () => {
    /*
     * Le cas qui décide de la durée de vie de la liste : ajouter une ligne en haut du fichier
     * décale toutes les erreurs sans qu'aucune soit créée ni corrigée. Une clé calée sur la ligne
     * rendrait la liste entièrement périmée à ce moment-là, et la porte exigerait de la
     * régénérer pour rien.
     */
    const avant = compterErreurs(journalGrille([10, 20]), ['2345'])
    const apres = compterErreurs(journalGrille([11, 21]), ['2345'])

    expect(serialiserDette(apres)).toBe(serialiserDette(avant))
  })

  it('ne retient que les codes demandés', () => {
    const autre = 'server/a.ts(1,1): error TS2322: Type X is not assignable to type Y.'

    expect(compterErreurs(autre, ['2345']).size).toBe(0)
    expect(compterErreurs(autre, ['2322']).size).toBe(1)
  })

  it('fait l’aller-retour par le fichier de dette, commentaires compris', () => {
    const comptes = compterErreurs(journalGrille([10, 20, 30]), ['2345'])
    const fichier = `# un commentaire\n\n${serialiserDette(comptes)}\n`

    expect(lireDette(fichier)).toEqual(comptes)
  })
})

describe('La porte ne bloque que ce qui n’est pas gelé', () => {
  const dette = serialiserDette(compterErreurs(journalGrille([10, 20, 30]), ['2345']))

  it('laisse passer la dette gelée, à l’identique', () => {
    const r = comparerALaDette(journalGrille([10, 20, 30]), dette, ['2345'])

    expect(r.nouvelles).toEqual([])
    expect(r.perimees).toEqual([])
    expect(r.gelees).toBe(3)
  })

  it('laisse passer la dette gelée même décalée de quelques lignes', () => {
    const r = comparerALaDette(journalGrille([12, 22, 32]), dette, ['2345'])

    expect(r.nouvelles).toEqual([])
    expect(r.perimees).toEqual([])
  })

  it('BLOQUE une erreur absente de la liste', () => {
    const neuve = `${journalGrille([10, 20, 30])}\nserver/api/neuf.ts(1,1): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`
    const r = comparerALaDette(neuve, dette, ['2345'])

    expect(r.nouvelles).toHaveLength(1)
    expect(r.nouvelles[0]).toContain('neuf.ts')
  })

  it('⚠️ BLOQUE une erreur de PLUS sur une entrée déjà gelée', () => {
    /*
     * Sans le compte, ce cas passerait : la paire (fichier, message) est déjà dans la liste. Or
     * c'est bien une régression — une colonne de tableau de plus qui ne typerait pas.
     */
    const r = comparerALaDette(journalGrille([10, 20, 30, 40]), dette, ['2345'])

    expect(r.nouvelles).toHaveLength(1)
    expect(r.nouvelles[0]).toContain('× 4 au lieu de 3')
  })

  it('📍 BLOQUE une entrée PÉRIMÉE, pour que le compteur descende', () => {
    /*
     * C'est le mécanisme demandé : corriger une erreur rend son entrée périmée, et la porte le
     * dit au lieu de se taire. Sans cela, la liste ne diminuerait jamais et finirait par décrire
     * un dépôt qui n'existe plus.
     */
    const r = comparerALaDette(journalGrille([10, 20]), dette, ['2345'])

    expect(r.nouvelles).toEqual([])
    expect(r.perimees).toHaveLength(1)
    expect(r.perimees[0]).toContain('1 entrée(s) à retirer')
  })

  it('📍 et ne dit RIEN quand la dette atteint zéro', () => {
    /*
     * Le cas final. Une garde qui se prouverait par la présence d'erreurs tomberait ici — au seul
     * moment où elle n'aurait plus rien à signaler. Journal vide et liste vide : tout va bien.
     */
    const r = comparerALaDette('', '', ['2345'])

    expect(r.nouvelles).toEqual([])
    expect(r.perimees).toEqual([])
    expect(r.gelees).toBe(0)
  })
})
