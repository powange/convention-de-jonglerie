import { describe, it, expect } from 'vitest'

import { lireSchema, verifier } from '../../../scripts/verifier-selects-prisma.mjs'

/**
 * Un champ Prisma qui n'existe pas fait rejeter la requête ENTIÈRE — un 500, pas un champ
 * manquant. Ce défaut a mordu quatre fois dans ce dépôt :
 *
 *  - un `_count` sur `assignments` alors que la relation s'appelle `assignedApplications` ;
 *  - un `timezone` demandé sur `Event`, qui ne le porte pas ;
 *  - `EditionOrganizer.userId` et `canManageArtists`, dans deux endpoints distincts ;
 *  - `Notification.notificationType`, qui n'est qu'un concept de service.
 *
 * Aucun outil en amont ne le voit : un `select` se rédige librement, ni le lint ni le typage
 * n'ont d'avis, et un test qui simule la base rend ce qu'on lui dit. Seule la confrontation au
 * SCHÉMA le voit — c'est ce que ce test fait tourner.
 */
describe('vérificateur des sélections Prisma', () => {
  it('lit le schéma', () => {
    const modeles = lireSchema()

    expect(modeles.size).toBeGreaterThan(50)
    expect(modeles.get('Edition')?.has('timezone')).toBe(true)
    // Le piège exact du deuxième incident : les deux modèles sont voisins, un seul porte le champ.
    expect(modeles.get('Event')?.has('timezone')).toBe(false)
  })

  it('connaît les clés composées, qui ne sont pas des champs', () => {
    // `where: { editionId_userId: {...} }` est valide et dérivé d'un `@@unique`. Sans cette
    // connaissance, le vérificateur criait au loup sur une vingtaine de requêtes légitimes.
    expect(lireSchema().get('EditionArtist')?.has('editionId_userId')).toBe(true)
  })

  it('ne trouve aucun champ inconnu dans le dépôt', () => {
    const constats = verifier()

    expect(
      constats.map((c) => `${c.fichier}:${c.ligne} ${c.modele}.${c.cle}`),
      'des champs Prisma ne correspondent à aucun champ du schéma'
    ).toEqual([])
  })
})
