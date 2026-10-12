import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Les deux specs qui écrivent le profil ne partagent plus de compte — constat CI·4.
 *
 * ## Le défaut
 *
 * Tous les tests du projet `authenticated` partageaient UN compte, et deux d'entre eux écrivent le
 * profil : `profile.spec.ts` (allergies, contact d'urgence) et `langue-du-profil.spec.ts`
 * (langue). Or `PUT /api/profile/update` a une sémantique de REMPLACEMENT — il exige un profil
 * complet et écrase ce qu'on ne lui envoie pas. En parallèle, la seconde écriture effaçait donc
 * les champs de la première : une mise à jour perdue, et un test qui échoue sur une valeur qu'il a
 * bien envoyée.
 *
 * La protection était un `workers: 1` sur tout le projet — un contournement, pas une correction.
 *
 * 📍 **Lire le profil avant d'écrire n'aurait pas suffi.** C'est ce que faisait déjà la spec de la
 * langue : deux lectures-modifications-écritures entrelacées perdent toujours l'une des deux.
 * Seuls deux comptes rendent ces specs indépendantes.
 *
 * ## ⚠️⚠️ CE QUE CETTE GARDE PROTÈGE VRAIMENT
 *
 * Pas la parallélisation — elle ne gagne aucune seconde, mesuré : ce projet tourne dans le lot
 * `publics`, à 105 s, le plus court des huit, quand le chemin critique de la CI est le job des
 * tests Nuxt à 7 min 56.
 *
 * Elle protège contre **la disparition silencieuse** : la spec de la langue vit désormais dans son
 * propre projet Playwright, et un projet que la matrice de la CI n'appelle pas **n'est tout
 * simplement pas joué — sans qu'aucun test n'échoue**. C'est le mode de panne le plus coûteux de
 * ce découpage, et aucun des deux fichiers ne peut le signaler seul.
 */
const RACINE = path.resolve(__dirname, '../../../../..')
const lire = (relatif: string) => fs.readFileSync(path.resolve(RACINE, relatif), 'utf8')

/**
 * Le code d'un fichier, **commentaires retirés**.
 *
 * ⚠️⚠️ CETTE FONCTION EXISTE PARCE QUE LE PIÈGE A MORDU EN ÉCRIVANT CE FICHIER. Le bloc du projet
 * `authenticated` EXPLIQUE, en citant `workers: 1`, pourquoi il ne le porte plus. Chercher la
 * chaîne telle quelle accusait donc le fichier qui a fait le travail — et le cas échouait sur un
 * correctif qui fonctionne. Septième occurrence de ce motif dans ce dépôt.
 */
const sansCommentaires = (relatif: string): string =>
  lire(relatif)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const CONFIG = 'apps/app1/playwright.config.ts'
const WORKFLOW = '.github/workflows/tests.yml'

describe('Playwright — les deux specs du profil sont indépendantes', () => {
  it('la spec de la langue a son propre projet et son propre compte', () => {
    const config = lire(CONFIG)
    expect(config).toContain("name: 'authenticated-langue'")
    expect(config).toContain("name: 'setup-langue'")
    expect(config).toContain('storageState: authFileLangue')
  })

  it('le projet partagé exclut la spec de la langue', () => {
    // 📍 Sans cette exclusion, `testMatch: /authenticated\\//` l'attraperait AUSSI ici : elle
    // tournerait deux fois, sur les deux comptes, et le conflit reviendrait à l'identique.
    expect(lire(CONFIG)).toContain('testIgnore: /langue-du-profil\\.spec\\.ts/')
  })

  it('le projet partagé n’est plus sérialisé', () => {
    // La signature du contournement : un `workers: 1` dans le bloc du projet `authenticated`.
    const config = sansCommentaires(CONFIG)
    const debut = config.indexOf("name: 'authenticated',")
    const fin = config.indexOf("name: 'authenticated-langue',")
    expect(debut).toBeGreaterThan(-1)
    expect(fin).toBeGreaterThan(debut)
    expect(config.slice(debut, fin)).not.toContain('workers: 1')
  })

  it('`edition-management` reste sérialisé, lui', () => {
    // Le témoin : ce projet partage UNE édition et doit le rester. Un test qui ne vérifierait que
    // l'absence de `workers: 1` passerait au vert si on les avait tous retirés.
    const config = sansCommentaires(CONFIG)
    const debut = config.indexOf("name: 'edition-management',")
    expect(debut).toBeGreaterThan(-1)
    expect(config.slice(debut)).toContain('workers: 1')
  })

  it('⚠️ la CI appelle bien les DEUX projets authentifiés', () => {
    // Le mode de panne le plus coûteux : un projet que la matrice n'appelle pas n'est pas joué, et
    // AUCUN test n'échoue pour le dire.
    const workflow = lire(WORKFLOW)
    expect(workflow).toContain('--project=authenticated --project=authenticated-langue')
  })

  it('le parcours d’inscription n’est écrit qu’une fois', () => {
    // Deux comptes, mais un seul parcours : dupliquer ces cent lignes d'interface ferait deux
    // choses à réparer au prochain changement du formulaire d'inscription.
    const aide = lire('apps/app1/test/e2e/playwright/creer-compte-e2e.ts')
    expect(aide).toContain('export async function creerUnCompteE2E(')
    for (const setup of ['auth.setup.ts', 'auth-langue.setup.ts']) {
      const code = lire(`apps/app1/test/e2e/playwright/${setup}`)
      expect(code, setup).toContain('creerUnCompteE2E(')
      // Et le parcours lui-même n'y est plus : la signature en est l'appel au code de
      // vérification, qui ne doit vivre que dans l'aide partagée.
      expect(code, setup).not.toContain('getVerificationCodeFromLogs')
    }
  })

  it('seule la spec de la langue écrit le profil hors du projet partagé', () => {
    // 📍 L'invariant qui autorise à retirer `workers: 1` : si un TROISIÈME fichier du projet
    // partagé se mettait à écrire le profil, le conflit reviendrait — sur le compte principal
    // cette fois, et entre deux fichiers qui n'ont rien à voir avec la langue.
    const dossier = path.resolve(RACINE, 'apps/app1/test/e2e/playwright/authenticated')
    const ecrivains = fs
      .readdirSync(dossier)
      .filter((f) => f.endsWith('.spec.ts'))
      .filter((f) => fs.readFileSync(path.join(dossier, f), 'utf8').includes('profile/update'))
      .sort()
    expect(ecrivains).toEqual(['langue-du-profil.spec.ts', 'profile.spec.ts'])
  })
})
