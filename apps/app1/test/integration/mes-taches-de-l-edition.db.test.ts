import bcrypt from 'bcryptjs'
import { describe, it, expect, beforeEach } from 'vitest'

import { compterMesTachesDeLEdition } from '../../server/utils/mes-taches-de-l-edition'
import { getEmailHash } from '../../server/utils/email-hash'
import { prismaTest } from '../setup-db'

/**
 * Le comptage des tâches assignées, contre une VRAIE base.
 *
 * ⚠️ CE FICHIER EXISTE PARCE QU'UN BOUCHON NE POUVAIT PAS ATTRAPER LE DÉFAUT. La requête écrivait
 * `task: { taskGroup: … }` au lieu de `task: { group: … }` — le nom de la relation, et non celui de
 * sa clé étrangère `taskGroupId`. Prisma refuse à l'exécution, et c'était un **500 sur
 * `/api/editions/[id]`** : la page d'édition entière cassée pour tout visiteur connecté d'une
 * édition où le module des tâches est actif.
 *
 * Le test Nuxt du point d'API était VERT : il comparait l'appel à la forme que j'avais moi-même
 * écrite, et un bouchon accepte n'importe quel objet. Il attestait donc ma propre faute. Seule une
 * requête qui atteint Prisma la voit — d'où ce fichier-ci, et d'où l'extraction de la requête dans
 * un util que la production et ce test appellent tous les deux. Une copie du `where` ici aurait
 * pu diverger de celui qui tourne vraiment.
 */
describe.skipIf(!process.env.TEST_WITH_DB)('Comptage des tâches assignées, avec DB réelle', () => {
  let utilisateur: { id: number }
  let autreUtilisateur: { id: number }
  let edition: { id: number }
  let autreEdition: { id: number }
  let groupe: { id: number }

  const compterPour = (userId: number, editionId: number) =>
    compterMesTachesDeLEdition(prismaTest, editionId, userId)

  beforeEach(async () => {
    const t = Date.now() + Math.floor(Math.random() * 1000)

    const creerCompte = async (suffixe: string) => {
      const email = `mes-taches-${suffixe}-${t}@example.com`
      return prismaTest.user.create({
        data: {
          email,
          emailHash: getEmailHash(email),
          password: await bcrypt.hash('Password123!', 10),
          pseudo: `mes-taches-${suffixe}-${t}`,
          isEmailVerified: true,
        },
      })
    }

    utilisateur = await creerCompte('moi')
    autreUtilisateur = await creerCompte('autre')

    // Une édition exige sa convention, qui exige son auteur. Le décor minimal est donc à trois
    // niveaux — et c'est la vraie base qui l'a dit : mon premier jet s'arrêtait à l'édition.
    const creerEdition = (nom: string) =>
      prismaTest.edition.create({
        data: {
          event: { create: {} },
          convention: { create: { name: `Convention ${nom} ${t}`, authorId: utilisateur.id } },
          name: `${nom} ${t}`,
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-03'),
          addressLine1: '1 rue des Massues',
          city: 'Lyon',
          country: 'France',
          postalCode: '69000',
        },
      })

    edition = await creerEdition('Édition des tâches')
    autreEdition = await creerEdition('Édition voisine')

    groupe = await prismaTest.taskGroup.create({
      data: { editionId: edition.id, name: `Groupe ${t}` },
    })
  })

  /** Une tâche du groupe, assignée à qui l'on veut. */
  const assigner = async (groupeId: number, userId: number, titre: string) => {
    const tache = await prismaTest.task.create({
      data: { taskGroupId: groupeId, title: titre },
    })
    await prismaTest.taskAssignment.create({ data: { taskId: tache.id, userId } })
    return tache
  }

  it('⚠️ la requête est acceptée par Prisma, et rend zéro sans assignation', async () => {
    // C'EST L'ASSERTION QUI COMPTE. Avant le correctif, cet appel levait
    // « Unknown argument taskGroup » : le test échouait ici, avant toute question de nombre.
    await expect(compterPour(utilisateur.id, edition.id)).resolves.toBe(0)
  })

  it('compte les tâches de cette édition assignées à cette personne', async () => {
    await assigner(groupe.id, utilisateur.id, 'Monter le chapiteau')
    await assigner(groupe.id, utilisateur.id, 'Démonter le chapiteau')

    await expect(compterPour(utilisateur.id, edition.id)).resolves.toBe(2)
  })

  it('ne compte pas les tâches assignées à quelqu’un d’autre', async () => {
    await assigner(groupe.id, autreUtilisateur.id, 'Tenir la buvette')

    await expect(compterPour(utilisateur.id, edition.id)).resolves.toBe(0)
    await expect(compterPour(autreUtilisateur.id, edition.id)).resolves.toBe(1)
  })

  it('⚠️ ne compte pas une tâche d’une AUTRE édition', async () => {
    /*
     * Le chemin de relation traverse deux niveaux — `TaskAssignment → Task → TaskGroup → edition`.
     * Sans ce cas, un chemin qui ignorerait l'édition rendrait les mêmes nombres que les tests
     * précédents, et personne ne le verrait.
     */
    const groupeVoisin = await prismaTest.taskGroup.create({
      data: { editionId: autreEdition.id, name: 'Groupe voisin' },
    })
    await assigner(groupeVoisin.id, utilisateur.id, 'Tâche de la voisine')

    await expect(compterPour(utilisateur.id, edition.id)).resolves.toBe(0)
    await expect(compterPour(utilisateur.id, autreEdition.id)).resolves.toBe(1)
  })
})
