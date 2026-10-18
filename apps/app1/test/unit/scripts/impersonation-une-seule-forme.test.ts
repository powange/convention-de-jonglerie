import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

/**
 * L'emprunt d'identité n'a qu'UNE forme, et la recopie ambiante ne doit pas en dériver.
 *
 * ## Pourquoi cette garde existe
 *
 * Cette forme était déclarée **trois fois**, et les trois ne s'accordaient pas :
 *
 * | où | ce qui était écrit |
 * | --- | --- |
 * | `impersonation-helpers.ts` | correct, `nom`/`prenom` nullables |
 * | `app/types/nuxt-auth-utils.d.ts` | `nom`/`prenom` **non nuls**, alors que la base dit `String?` |
 * | `SessionMeResponse.impersonation` | `{ originalUserId, originalPseudo, impersonatedAt }` — **deux champs sur trois n'existaient nulle part** |
 *
 * Le troisième était une fiction complète : le serveur renvoie l'objet rangé dans le cookie, qui
 * porte `originalUserPseudo` et `startedAt`, et le magasin client lit ces mêmes noms. Le contrat
 * déclaré ne décrivait ni ce qui est produit, ni ce qui est consommé — et personne ne l'a vu parce
 * que les deux bouts le contournent (`initFromSession(sessionData: any)`).
 *
 * Deux des trois sont désormais une seule définition (`SessionImpersonation` dans
 * `shared/types/api.ts`, aliasée par le serveur). La troisième reste une **recopie assumée** : un
 * `import type` fonctionnerait dans ce bloc ambiant, mais une déclaration de module ambiante a
 * déjà coûté 93 erreurs `TS2305` à ce dépôt en masquant la résolution de Nuxt, et le typage ne
 * tourne pas en local pour l'éprouver. D'où cette garde plutôt qu'un remaniement à l'aveugle.
 *
 * ⚠️ Elle compare les CHAMPS, pas le texte : un commentaire ou un ordre différent ne la fait pas
 * crier, une nullabilité qui diverge si.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const PARTAGE = join(RACINE, 'shared/types/api.ts')
const AMBIANT = join(RACINE, 'app/types/nuxt-auth-utils.d.ts')

/** Les champs d'une interface, sous forme `nom: type` normalisé, commentaires retirés. */
const champsDe = (chemin: string, nomInterface: string): string[] => {
  const source = readFileSync(chemin, 'utf8')
  const debut = source.indexOf(`interface ${nomInterface} {`)
  expect(debut, `interface \`${nomInterface}\` introuvable dans ${chemin}`).toBeGreaterThan(-1)

  /*
   * ⚠️ On compte les ACCOLADES, et non la première occurrence de « \n} ».
   *
   * La première version cherchait `'\\n}'`, ce qui marche pour une interface au niveau racine et
   * PAS pour celle du fichier ambiant, indentée dans un `declare module` : sa fermeture est
   * « \n  } ». L'extracteur avalait alors tout le reste du fichier — vingt-cinq « champs » dont
   * `export function clearUserSession(...)`. La garde a crié, mais sur son propre défaut.
   */
  const corps = source.slice(debut + `interface ${nomInterface} {`.length)
  let profondeur = 1
  let fin = -1
  for (let i = 0; i < corps.length; i++) {
    if (corps[i] === '{') profondeur++
    else if (corps[i] === '}') {
      profondeur--
      if (profondeur === 0) {
        fin = i
        break
      }
    }
  }
  expect(fin, `fin de \`${nomInterface}\` introuvable`).toBeGreaterThan(-1)

  return corps
    .slice(0, fin)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .split('\n')
    .map((l) => l.trim().replace(/,$/, '').replace(/\s+/g, ' '))
    .filter((l) => l.includes(':'))
    .sort()
}

describe('Emprunt d’identité : une seule forme', () => {
  const partage = champsDe(PARTAGE, 'SessionImpersonation')
  const ambiant = champsDe(AMBIANT, 'ImpersonationData')

  it('le témoin : les deux formes sont bien LUES, et non vides', () => {
    /*
     * Sans ce cas, une comparaison de deux listes vides serait verte — le défaut classique d'une
     * garde qui lit un fichier au mauvais chemin. Le seuil est bas et stable.
     */
    expect(partage.length, `rien lu dans ${PARTAGE}`).toBeGreaterThan(5)
    expect(ambiant.length, `rien lu dans ${AMBIANT}`).toBeGreaterThan(5)
  })

  it('la recopie ambiante ne diverge pas de la définition partagée', () => {
    expect(
      ambiant,
      `la recopie de \`ImpersonationData\` dans la déclaration ambiante a dérivé de\n` +
        `\`SessionImpersonation\` (shared/types/api.ts). Réaligner les deux.\n` +
        `partagé : ${JSON.stringify(partage, null, 2)}\n` +
        `ambiant : ${JSON.stringify(ambiant, null, 2)}`
    ).toEqual(partage)
  })

  it('📍 `nom` et `prenom` restent NULLABLES des deux côtés', () => {
    /*
     * Le défaut d'origine : la déclaration ambiante les annonçait `string`, alors que `User.nom` et
     * `User.prenom` sont `String?` en base. Un cas dédié, parce que c'est la divergence précise qui
     * s'était installée et que la comparaison globale ci-dessus la nommerait moins clairement.
     */
    for (const [ou, champs] of [
      ['partagé', partage],
      ['ambiant', ambiant],
    ] as const) {
      for (const champ of ['originalUserNom', 'originalUserPrenom']) {
        expect(
          champs.find((c) => c.startsWith(champ)),
          `${champ} devrait être nullable côté ${ou}`
        ).toContain('| null')
      }
    }
  })
})
