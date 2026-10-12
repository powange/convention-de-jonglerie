import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * La création d'une sauvegarde ne passe plus par la mémoire — constat O1 de l'administration.
 *
 * ## Le défaut
 *
 * `execFile('mysqldump', …, { maxBuffer: 50 Mo })` capturait TOUTE la sortie en mémoire, puis
 * l'écrivait d'un bloc. Au-delà, Node tue le processus avec « stdout maxBuffer length exceeded » :
 * le bouton « Créer une sauvegarde » échoue net, sans contournement — et c'est précisément la
 * sauvegarde qu'on fait **avant** un déploiement risqué.
 *
 * ## 📊 Mesuré avant de corriger
 *
 * Le dump de la base de développement pèse **5,9 Mo**, soit huit fois sous le plafond. Ce n'est
 * donc pas un incident, c'est une **échéance** — et les trois tables qui la rapprochent sont
 * celles qui grossissent toutes seules :
 *
 * | table | lignes | poids |
 * | --- | --- | --- |
 * | `ApiErrorLog` | 779 | 2,95 Mo |
 * | `Notification` | 2 380 | 2,23 Mo |
 * | `TicketingOrderItem` | 1 529 | 1,92 Mo |
 *
 * À elles trois, 7,1 Mo des 17 Mo de la base. Une production plus ancienne franchit les 50 Mo
 * sans rien faire de particulier.
 *
 * 📍 **La restauration savait déjà travailler en flux** : c'est la création qui n'avait pas suivi.
 * L'asymétrie était le défaut.
 *
 * ## ⚠️ POURQUOI UNE GARDE DE SOURCE ET NON UN TEST MONTÉ
 *
 * Ce point d'API lance `mysqldump` et `tar`, écrit dans `backups/` et lit le dossier d'uploads :
 * le monter demanderait de doubler quatre modules de Node pour éprouver… quatre lignes
 * d'appel. Ce qui compte ici est la FORME de l'appel, et elle se lit. Le verrou de concurrence,
 * lui, a ses propres cinq tests unitaires (`synchronisation-unique.test.ts`) ; ce qui restait à
 * prouver est que ce point d'API y passe.
 */
const SOURCE = join(import.meta.dirname, '../../../server/api/admin/backup/create.post.ts')

function code(): string {
  // Les commentaires sont retirés : ce fichier EXPLIQUE l'ancien `maxBuffer` et l'ancien
  // `execFile`, et les compter ferait de ces explications des infractions. Le piège a déjà mordu
  // six fois dans ce dépôt — dont une fois sur la garde des journaux HelloAsso, écrite ce jour.
  return readFileSync(SOURCE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

describe('création de sauvegarde', () => {
  it('⚠️ NE CAPTURE PLUS LE DUMP EN MÉMOIRE', () => {
    const src = code()
    // `spawn` et non `execFile` : ce dernier capture par construction.
    expect(src).toMatch(/spawn\(\s*'mysqldump'/)
    expect(
      /execFileAsync\(\s*'mysqldump'/.test(src),
      'le dump repasse par `execFile`, qui capture toute la sortie'
    ).toBe(false)
  })

  it('⚠️ AUCUN PLAFOND N’ENCADRE PLUS LE DUMP', () => {
    /*
     * Le témoin du précédent : on pourrait employer `spawn` et garder un plafond ailleurs. Ce qui
     * doit avoir disparu, c'est le `maxBuffer` du DUMP — celui de `tar` reste, et ne borne rien
     * (tar écrit dans un fichier, sa sortie standard est vide).
     */
    /*
     * ⚠️⚠️ ET L'ANCRE NE SUPPOSE PAS LA MISE EN FORME. Ma première version cherchait
     * `spawn('mysqldump'` d'une pièce : après passage de Prettier, l'appel tient sur DEUX lignes
     * (`spawn(` puis `'mysqldump',`), donc `indexOf` rendait -1, la tranche était vide, et le
     * sabotage qui remettait un `maxBuffer` passait au vert. Deuxième fois aujourd'hui qu'un
     * motif aveugle à la mise en forme exempte en silence.
     */
    const src = code()
    const debut = src.search(/spawn\(\s*'mysqldump'/)
    expect(debut, "l'appel à spawn('mysqldump') est introuvable").toBeGreaterThan(-1)
    const fin = src.indexOf('const sortieDump', debut)
    expect(fin, 'la fin du bloc du dump est introuvable').toBeGreaterThan(debut)

    expect(src.slice(debut, fin)).not.toContain('maxBuffer')
  })

  it('écrit le dump dans un FLUX vers le disque', () => {
    const src = code()
    expect(src).toContain('createWriteStream(sqlPath)')
    expect(src).toContain('pipeline(')
  })

  it('⚠️ UN DUMP RATÉ NE LAISSE PAS DE FICHIER À MOITIÉ ÉCRIT', () => {
    /*
     * Un fichier tronqué à côté des vraies sauvegardes est pire qu'une absence : un administrateur
     * le prendrait pour une sauvegarde valide, et ne s'en apercevrait qu'en restaurant.
     */
    const src = code()
    expect(src).toMatch(/catch[\s\S]{0,200}unlink\(sqlPath\)/)
  })

  it('⚠️ DEUX CLICS NE LANCENT PAS DEUX DUMPS', () => {
    // La seconde moitié du constat. Le mécanisme est éprouvé à part ; ce qui se vérifie ici est
    // le branchement — un util juste et branché nulle part ne corrige rien.
    expect(code()).toMatch(/synchronisationUnique\(\s*'sauvegarde'/)
  })

  it('le balayage lit bien le fichier — il ne conclut pas sur le vide', () => {
    expect(code().length, 'source vide ou introuvable').toBeGreaterThan(2000)
  })
})
