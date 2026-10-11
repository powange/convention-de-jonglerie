import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const DEPOT = join(process.cwd(), '..', '..')

/**
 * Un point d'API en lecture n'écrit pas — constat F7.
 *
 * ## Le défaut
 *
 * L'import des commandes HelloAsso vivait dans `orders.get.ts`, c'est-à-dire **sur un GET**, alors
 * qu'il écrit : `upsert` de la commande, `update`/`create` des lignes, `upsert` des options,
 * `create` des repas, puis la date de dernière synchronisation.
 *
 * **Un GET est rejoué sans intention** — rechargement, retour arrière, préchargement du
 * navigateur, lien ouvert deux fois. Les écritures étant des `upsert`, les données n'en
 * souffraient pas : le coût était en **temps et en verrous**, sur une transaction touchant
 * plusieurs centaines de lignes.
 *
 * ## ⚠️ Pourquoi une garde, et pas seulement le renommage
 *
 * Renommer un fichier ne dit rien du prochain. Ce test refuse qu'une **écriture** apparaisse dans
 * un `*.get.ts`, et la dette est à **zéro** : c'est donc une interdiction.
 *
 * ## 📍 CE QUI EST TOLÉRÉ, ET POURQUOI
 *
 * Deux familles d'écritures légitimes sur un GET, nommées et vérifiées positivement plus bas :
 *
 * 1. **la journalisation** — consigner un accès, un refus ou une erreur n'est pas un effet que
 *    l'appelant a demandé, et le rejouer ne coûte qu'une ligne de journal ;
 * 2. **la mémorisation d'une lecture** — poser « vu à telle heure » appartient à l'acte de lire.
 *
 * Elles sont listées par chemin plutôt que devinées sur le nom de la table : une liste explicite
 * se relit, un motif approximatif laisse passer ce qu'il n'avait pas prévu.
 */

/** Les écritures Prisma, telles qu'elles s'écrivent dans ce dépôt. */
const ECRITURES =
  /\b(?:prisma|tx)\.[\w.]+\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/

/**
 * Les `*.get.ts` qui écrivent pour une raison NOMMÉE et défendable.
 *
 * ⚠️ Chaque entrée est vérifiée POSITIVEMENT par un cas plus bas : une exception périmée
 * exempterait sinon en silence un fichier revenu en arrière pour une tout autre raison.
 */
const EXCEPTIONS: Record<string, string> = {
  // Le fournisseur OAuth REDIRIGE le navigateur : le verbe est imposé par le protocole, pas
  // choisi. Créer le compte et ouvrir la session est tout l'objet de ce rappel.
  'layers/auth/server/routes/auth/google.get.ts': 'rappel OAuth — le verbe est imposé par Google',
  'layers/auth/server/routes/auth/facebook.get.ts':
    'rappel OAuth — le verbe est imposé par Facebook',
  // Poser « lu à telle heure » appartient à l'acte de lire : rejouer la lecture rejoue la même
  // marque, et il n'y a rien d'autre à annuler.
  'apps/app1/server/api/messenger/conversations/[conversationId]/messages/index.get.ts':
    'marque la conversation comme lue — mémorisation de la lecture elle-même',
  // `upsert` d'une ligne unique de configuration, idempotent : le premier appel la crée, les
  // suivants ne changent rien.
  'apps/app1/server/api/admin/ai/config.get.ts':
    'initialisation paresseuse de la configuration unique, idempotente',
}

/**
 * ⚠️⚠️ DETTE CONNUE — un défaut, pas une exception. Trouvé PAR cette garde, le 11/10/2026.
 *
 * `meals.get.ts` RÉCONCILIE les sélections de repas d'un artiste à la lecture : il `deleteMany`
 * celles dont le repas n'est plus éligible, puis `createMany` les manquantes **avec
 * `accepted: true`**.
 *
 * Deux conséquences qui dépassent le coût en verrous :
 *
 * 1. **ouvrir l'écran crée des acceptations** — un artiste qui n'a rien répondu est enregistré
 *    comme acceptant le repas, et ce chiffre nourrit la restauration ;
 * 2. un refus (`accepted: false`) dont le repas devient temporairement inéligible est
 *    **supprimé**, puis recréé à `true` au passage suivant : **le refus se retourne en
 *    acceptation**, sans que rien ne le dise.
 *
 * Ce n'est pas corrigé ici : le défaut touche le comptage des repas, et « accepté par défaut »
 * est une DÉCISION de produit — c'est peut-être voulu pour les artistes, dont la restauration est
 * souvent comprise dans le contrat. La question est posée à l'utilisateur ; d'ici là, l'entrée
 * reste inscrite pour que la garde ne se taise pas dessus.
 */
const DETTE: Record<string, string> = {
  'layers/artists/server/api/editions/[id]/artists/[artistId]/meals.get.ts':
    'réconcilie les sélections de repas à la lecture, et les crée à accepted=true',
}

async function fichiersGet(): Promise<string[]> {
  const trouves: string[] = []
  async function parcourir(dossier: string) {
    for (const entree of await readdir(dossier, { withFileTypes: true })) {
      const complet = join(dossier, entree.name)
      if (entree.isDirectory()) {
        if (entree.name === 'node_modules') continue
        await parcourir(complet)
      } else if (entree.name.endsWith('.get.ts')) {
        trouves.push(complet)
      }
    }
  }
  await parcourir(join(DEPOT, 'apps', 'app1', 'server', 'api'))
  await parcourir(join(DEPOT, 'layers'))
  return trouves
}

describe('aucune écriture derrière un GET', () => {
  it('⚠️ UN `*.get.ts` N’ÉCRIT PAS EN BASE', async () => {
    const fautifs: string[] = []
    for (const chemin of await fichiersGet()) {
      const relatif = chemin.slice(DEPOT.length + 1)
      if (relatif in EXCEPTIONS || relatif in DETTE) continue
      const source = await readFile(chemin, 'utf8')
      // Les lignes de commentaire sont retirées : plusieurs fichiers EXPLIQUENT en commentaire
      // pourquoi ils n'écrivent plus, et les compter ferait de ces explications des infractions.
      const code = source
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n')
      if (ECRITURES.test(code)) fautifs.push(relatif)
    }

    expect(
      fautifs,
      `Un GET est rejoué sans intention — rechargement, retour arrière, préchargement du ` +
        `navigateur. Déplacer l'écriture dans un point d'API nommé par son action ` +
        `(\`<action>.post.ts\`), et faire appeler celui-là par l'écran :\n${fautifs.join('\n')}`
    ).toEqual([])
  })

  it('les exceptions sont encore vraies — une liste périmée exempte en silence', async () => {
    /*
     * LA GARDE DE LA LISTE. Une exception qui ne décrit plus le fichier devient un trou qu'on a
     * oublié de refermer : elle exempterait un fichier qui s'est remis à écrire pour une tout
     * autre raison.
     */
    for (const [relatif, raison] of Object.entries({ ...EXCEPTIONS, ...DETTE })) {
      const source = await readFile(join(DEPOT, relatif), 'utf8')
      expect(
        ECRITURES.test(source),
        `${relatif} n'écrit plus : retirer l'exception « ${raison} »`
      ).toBe(true)
    }
  })

  it('le balayage voit bien des fichiers — il ne conclut pas sur le vide', async () => {
    /*
     * Le premier cas est une interdiction, donc **vert sur une liste vide**. Une erreur de chemin
     * et il ne vérifierait plus rien, tout en restant au vert — défaut déjà payé plusieurs fois
     * ici. On mesure les fichiers LUS, jamais la taille de la dette.
     */
    const fichiers = await fichiersGet()
    expect(fichiers.length, 'aucun `*.get.ts` trouvé : le balayage est cassé').toBeGreaterThan(150)
  })

  it('⚠️ L’IMPORT HELLOASSO EST BIEN UN POST, et l’ancien GET n’existe plus', async () => {
    /*
     * Le témoin du lot : sans lui, la garde ci-dessus serait satisfaite par la simple SUPPRESSION
     * de l'import — un fichier qui n'écrit plus parce qu'il a disparu. On vérifie donc que
     * l'écriture a été DÉPLACÉE, pas perdue.
     */
    const dossier = join(DEPOT, 'layers/ticketing/server/api/editions/[id]/ticketing/helloasso')
    const presents = await readdir(dossier)

    expect(presents).toContain('import.post.ts')
    expect(presents).not.toContain('orders.get.ts')

    const source = await readFile(join(dossier, 'import.post.ts'), 'utf8')
    expect(ECRITURES.test(source), 'import.post.ts n’écrit plus rien : l’import a été perdu').toBe(
      true
    )
  })
})
