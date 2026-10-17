import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Aucune requête ne ramène une ligne `User` entière — garde à l'échelle du dépôt.
 *
 * ## Le défaut
 *
 * `include: { user: true }` ramène **toutes** les colonnes de `User`, dont l'empreinte bcrypt du
 * mot de passe, `emailHash`, `googleId`, `facebookId`. Le `CLAUDE.md` impose d'ailleurs les aides
 * de `prisma-select-helpers.ts` « au lieu de dupliquer les sélections de champs », et d'étendre
 * par spread quand il manque un champ.
 *
 * ## 📍 Ce que la mesure a appris, et qui corrige le relevé
 *
 * Le relevé annonçait « 160 `include` sans `select` » en ajoutant que « c'est ainsi qu'une adresse
 * de courriel finit par sortir d'un point d'API qui ne devait pas la rendre ». Mesuré : **180**
 * sans select, dont **25** touchant une relation d'apparence utilisateur — mais **zéro** point
 * d'API ne rend un objet Prisma brut contenant un `User` complet. Toutes les réponses sont
 * recomposées à la main.
 *
 * **La fuite annoncée n'existait donc pas.** Ce qui existait est plus étroit, et plus intéressant :
 * sur les 7 `include: { user: true }` du dépôt, **3 étaient entièrement morts** — rien ne les
 * consommait. Deux d'entre eux sur le parcours de **réinitialisation de mot de passe** et
 * d'invitation, où le handler ne lit que `resetToken.userId`, un scalaire du jeton. Ils lisaient
 * l'empreinte bcrypt du compte pour la jeter, là même où un mot de passe se pose.
 *
 * ## ⚠️ LES COMMENTAIRES SONT RETIRÉS, et ce n'est pas théorique
 *
 * Les quatre fichiers corrigés EXPLIQUENT le défaut en citant `user: true` dans leurs
 * commentaires. Ma première vérification a d'ailleurs rendu 5 occurrences — toutes dans mes
 * propres commentaires. Sans ce retrait, la garde se prouverait sur l'explication au lieu du code.
 */
// ⚠️ CINQ niveaux : outillage → unit → test → app1 → apps → racine. Mon premier essai en
// mettait quatre et scandait `apps/apps/app1` — le témoin de fin de fichier l'a fait échouer
// bruyamment, au lieu de laisser la garde passer au vert sur une liste vide. Même erreur que
// sur la garde des quotas.
const RACINE = join(import.meta.dirname, '../../../../..')
const DOSSIERS = [join(RACINE, 'apps/app1/server'), join(RACINE, 'layers')]

function fichiers(dossier: string): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier)) {
    if (entree === 'node_modules' || entree === 'generated' || entree.startsWith('.')) continue
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin))
    else if (entree.endsWith('.ts')) trouves.push(chemin)
  }
  return trouves
}

const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('aucune requête ne ramène une ligne `User` entière', () => {
  const balayes = DOSSIERS.flatMap(fichiers)

  it('⚠️ PLUS AUCUN `user: true`, NULLE PART DANS LE CODE SERVEUR', () => {
    const coupables = balayes
      .filter((chemin) => /\buser:\s*true\b/.test(sansCommentaires(readFileSync(chemin, 'utf8'))))
      .map((chemin) => chemin.slice(RACINE.length + 1))

    expect(
      coupables,
      'ces requêtes ramènent toute la ligne User, mot de passe compris ; employer une aide de prisma-select-helpers'
    ).toEqual([])
  })

  it('le balayage voit bien le dépôt — il ne conclut pas sur le vide', () => {
    /*
     * Le témoin, et il est indispensable : une résolution de chemin fautive rendrait le cas
     * ci-dessus vert en ne lisant AUCUN fichier. Déjà arrivé sur la garde des quotas.
     */
    expect(balayes.length, 'aucun fichier balayé : chemin faux ?').toBeGreaterThan(500)

    const avecPrisma = balayes.filter((c) => /prisma\.\w+\./.test(readFileSync(c, 'utf8')))
    expect(
      avecPrisma.length,
      'aucune requête Prisma vue : le motif ne correspond plus'
    ).toBeGreaterThan(100)
  })
})
