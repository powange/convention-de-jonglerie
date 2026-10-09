import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Un seul mécanisme d'authentification dans les handlers : `requireAuth`.
 *
 * ## Pourquoi ce test existe
 *
 * Mesuré le 09/10/2026 : **414 handlers** emploient `requireAuth`, et **8** employaient
 * `requireUserSession`. Trois de ces huit étaient les points d'API des organisateurs d'une
 * édition, dans le même dossier qu'un quatrième qui, lui, employait `requireAuth` — avec un
 * commentaire expliquant pourquoi, et qui **affirmait faussement** que « c'est déjà ce qu'emploie
 * le POST voisin ».
 *
 * ## Ce que la divergence coûte, et ce qu'elle ne coûte PAS
 *
 * ⚠️ Le constat d'audit annonçait un risque d'écart sur l'**usurpation d'identité admin**. C'est
 * FAUX, et il valait mieux le vérifier que le croire : l'usurpation remplace l'utilisateur **dans
 * la session** (`impersonate.post.ts` appelle `ouvrirSession` avec le compte cible), et le
 * middleware fait `event.context.user = session.user` — le même objet. Les deux mécanismes voient
 * donc exactement la même personne.
 *
 * Ce qui est réel :
 *
 * - `requireUserSession` **relit et descelle le cookie une seconde fois**, alors que le middleware
 *   a déjà posé l'utilisateur sur le contexte. C'est une lecture par requête, pour rien.
 * - Son retour n'est pas typé `AuthenticatedUser` : `id` et `isGlobalAdmin`, que les contrôles de
 *   permission attendent, ne sont pas garantis par le type.
 * - Deux mécanismes pour une question, c'est la porte ouverte au prochain qui diverge — et c'est
 *   ce que ce test ferme.
 *
 * ## Les exceptions, et pourquoi chacune est admise
 *
 * Elles sont nommées une par une, jamais couvertes par un motif : une liste d'exceptions large
 * finit par exempter ce qu'elle devait surveiller.
 */

const RACINES = [
  path.resolve(__dirname, '../../../server/api'),
  path.resolve(__dirname, '../../../../../layers'),
]

/**
 * Les handlers autorisés à employer `requireUserSession`, avec la raison.
 *
 * ⚠️ Ajouter une ligne ici est un geste délibéré, pas une formalité pour faire passer le test.
 * Le défaut par défaut est `requireAuth`.
 */
const EXCEPTIONS: Record<string, string> = {
  'apps/app1/server/api/session/me.get.ts':
    "Le point qui EXPOSE la session : il la lit par nature, et doit répondre sur une session que le middleware n'a pas hydratée.",
  'apps/app1/server/api/users/search.get.ts':
    'Relevé le 09/10/2026, à traiter avec le constat auth-profil A1 qui touche déjà ce fichier.',
  'layers/workshops/server/api/editions/[id]/workshops/can-create.get.ts':
    'Module ateliers — hors du périmètre du lot organisateurs ; à aligner avec les constats de ce module.',
  'layers/workshops/server/api/editions/[id]/workshops/[workshopId]/favorite.post.ts':
    'Idem ateliers.',
  'layers/workshops/server/api/editions/[id]/workshops/[workshopId]/favorite.delete.ts':
    'Idem ateliers.',
}

/** Tous les handlers d'API du dépôt, chemin relatif à la racine du dépôt. */
function handlers(): { chemin: string; contenu: string }[] {
  const trouves: { chemin: string; contenu: string }[] = []
  const racineDepot = path.resolve(__dirname, '../../../../..')

  const parcours = (dossier: string) => {
    if (!fs.existsSync(dossier)) return
    for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, entree.name)
      if (entree.isDirectory()) {
        if (entree.name === 'node_modules' || entree.name === '.nuxt') continue
        parcours(complet)
      } else if (entree.name.endsWith('.ts')) {
        // Dans `layers`, seuls les dossiers `server/api` nous intéressent.
        if (!complet.includes(`${path.sep}server${path.sep}api${path.sep}`)) continue
        trouves.push({
          chemin: path.relative(racineDepot, complet).split(path.sep).join('/'),
          contenu: fs.readFileSync(complet, 'utf8'),
        })
      }
    }
  }
  RACINES.forEach(parcours)
  return trouves
}

describe('authentification des handlers — un seul mécanisme', () => {
  const tous = handlers()

  it('trouve bien les handlers du dépôt', () => {
    // La garde de la garde : un parcours qui ne trouverait rien rendrait tous les tests
    // ci-dessous verts en ne vérifiant rien.
    expect(tous.length).toBeGreaterThan(400)
  })

  it('aucun handler n’emploie requireUserSession hors des exceptions nommées', () => {
    const fautifs = tous
      .filter(({ contenu }) => contenu.includes('requireUserSession('))
      .map(({ chemin }) => chemin)
      .filter((chemin) => !(chemin in EXCEPTIONS))

    expect(fautifs, `employer requireAuth, ou justifier l'exception dans EXCEPTIONS`).toEqual([])
  })

  it('les exceptions déclarées existent encore et emploient bien requireUserSession', () => {
    /*
     * Sans cette vérification, une exception corrigée resterait dans la liste et exempterait
     * silencieusement un fichier revenu en arrière — exactement le défaut d'une garde par liste
     * d'exceptions qu'on ne relit pas.
     */
    const parChemin = new Map(tous.map(({ chemin, contenu }) => [chemin, contenu]))

    for (const chemin of Object.keys(EXCEPTIONS)) {
      const contenu = parChemin.get(chemin)
      expect(contenu, `${chemin} : exception déclarée pour un fichier introuvable`).toBeDefined()
      expect(
        contenu!.includes('requireUserSession('),
        `${chemin} n'emploie plus requireUserSession : retirer son exception`
      ).toBe(true)
    }
  })

  it('les trois points d’API des organisateurs emploient requireAuth', () => {
    // Le lot qui a motivé ce test. Nommés explicitement : si l'un repassait à
    // `requireUserSession`, le test précédent le dirait déjà, mais celui-ci dit POURQUOI.
    const organisateurs = tous.filter(
      ({ chemin }) => chemin.includes('/organizers/') && !chemin.includes('/layers/')
    )
    expect(organisateurs.length).toBeGreaterThanOrEqual(3)

    for (const { chemin, contenu } of organisateurs) {
      expect(contenu, `${chemin} emploie encore requireUserSession`).not.toContain(
        'requireUserSession('
      )
    }
  })
})
