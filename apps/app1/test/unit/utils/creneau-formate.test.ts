import { describe, expect, it } from 'vitest'

import {
  formaterCreneau,
  inclusionCreneau,
} from '../../../../../layers/volunteers/server/utils/creneau-formate'

/**
 * La forme d'un créneau rendue au planning.
 *
 * Le défaut d'origine : le client ne recharge pas la liste après une écriture, il REMPLACE en
 * mémoire le créneau par celui que l'API vient de rendre. La liste, la création et la
 * modification produisaient chacune leur propre forme, et celles des deux écritures étaient
 * amputées. Déplacer un créneau effaçait donc à l'écran la photo des bénévoles, les
 * organisateurs affectés et le retard — le tout revenant au rechargement de la page, ce qui
 * rendait le symptôme incroyable pour qui le signalait.
 *
 * Ces tests portent sur ce que la forme DOIT contenir, pas sur ce qu'un appelant en fait.
 */

/** Un bénévole, lu avec son adresse — c'est le formatage qui décide de la rendre ou non. */
const personne = (id: number) => ({
  id,
  pseudo: `p${id}`,
  nom: 'Dupont',
  prenom: 'Jean',
  pronouns: 'il/lui',
  email: `p${id}@exemple.fr`,
  emailHash: `empreinte-${id}`,
  profilePicture: 'photo.jpg',
  updatedAt: new Date('2026-01-02T03:04:05Z'),
})

/**
 * Un organisateur, tel que la base le rend : SANS adresse de courriel.
 *
 * Ce n'est pas le formatage qui la retire pour eux, c'est la sélection qui ne la demande pas —
 * d'où l'assertion correspondante sur `inclusionCreneau` plus bas, et non ici.
 */
const organisateur = (id: number) => {
  const { email: _email, ...reste } = personne(id)
  return reste
}

const creneau = (surcharge: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    title: 'Bar du soir',
    description: 'Tenir le bar',
    startDateTime: new Date('2026-08-01T18:00:00Z'),
    endDateTime: new Date('2026-08-01T22:00:00Z'),
    teamId: 'bar',
    maxVolunteers: 3,
    delayMinutes: 15,
    team: { id: 'bar', name: 'Bar', color: '#ff0000' },
    assignments: [{ id: 'a1', user: personne(1) }],
    organizerAssignments: [{ editionOrganizer: { id: 7, organizer: { user: organisateur(2) } } }],
    _count: { assignments: 1 },
    ...surcharge,
  }) as any

describe('formaterCreneau', () => {
  it('porte de quoi AFFICHER la photo de chaque bénévole', () => {
    // Le cœur du défaut : sans ces trois champs, l'avatar retombait sur une adresse Gravatar
    // « inconnu » que le service rend en 404, et l'image restait cassée.
    const { assignments } = formaterCreneau(creneau())

    expect(assignments[0].user).toMatchObject({
      profilePicture: 'photo.jpg',
      emailHash: 'empreinte-1',
      updatedAt: new Date('2026-01-02T03:04:05Z'),
    })
  })

  it('porte les organisateurs affectés', () => {
    // Ils étaient purement absents de la réponse de modification : déplacer un créneau les
    // effaçait de l'affichage ET du compteur de places, qui les additionne aux bénévoles.
    const { organizerAssignments } = formaterCreneau(creneau())

    expect(organizerAssignments).toEqual([
      { editionOrganizerId: 7, user: expect.objectContaining({ id: 2, pseudo: 'p2' }) },
    ])
  })

  it('porte le retard du créneau', () => {
    expect(formaterCreneau(creneau()).delayMinutes).toBe(15)
  })

  it('rend un retard absent comme nul, et non comme indéfini', () => {
    // `undefined` disparaît à la sérialisation JSON : le client ne pourrait pas distinguer
    // « pas de retard » de « champ oublié par l'API », qui est précisément le défaut corrigé.
    expect(formaterCreneau(creneau({ delayMinutes: null })).delayMinutes).toBeNull()
  })

  it('porte les pronoms de chacun', () => {
    expect(formaterCreneau(creneau()).assignments[0].user).toMatchObject({ pronouns: 'il/lui' })
  })

  it('CACHE l’adresse de courriel par défaut', () => {
    // Le défaut par omission doit retirer une donnée, jamais en divulguer une.
    expect(formaterCreneau(creneau()).assignments[0].user).not.toHaveProperty('email')
  })

  it('rend l’adresse de courriel à qui a le droit de la lire', () => {
    expect(formaterCreneau(creneau(), true).assignments[0].user).toMatchObject({
      email: 'p1@exemple.fr',
    })
  })

  it('laisse l’organisateur tel que la base le rend', () => {
    // Le formatage ne filtre pas les organisateurs : leur adresse n'est simplement jamais
    // demandée. C'est `inclusionCreneau` qui en répond, et c'est là que le test vit.
    const { organizerAssignments } = formaterCreneau(creneau(), true)

    expect(organizerAssignments[0].user).not.toHaveProperty('email')
    expect(organizerAssignments[0].user).toMatchObject({ profilePicture: 'photo.jpg' })
  })

  it('donne au calendrier ce dont il a besoin pour placer l’événement', () => {
    const formate = formaterCreneau(creneau())

    expect(formate).toMatchObject({
      start: '2026-08-01T18:00:00.000Z',
      end: '2026-08-01T22:00:00.000Z',
      resourceId: 'bar',
      color: '#ff0000',
      assignedVolunteers: 1,
    })
  })

  it('range un créneau sans équipe dans la colonne « non assigné »', () => {
    const formate = formaterCreneau(creneau({ teamId: null, team: null }))

    expect(formate.resourceId).toBe('unassigned')
    expect(formate.color).toBe('#6b7280')
  })
})

describe('inclusionCreneau', () => {
  /**
   * Ces assertions portent sur la REQUÊTE et non sur le résultat : un mock Prisma rend ce qu'on
   * lui dit, pas ce que la sélection demande. Un test qui n'observerait que la réponse resterait
   * vert avec une sélection amputée — c'est ainsi que le défaut a survécu.
   */
  it('demande à la base de quoi afficher une photo de bénévole', () => {
    expect(inclusionCreneau.assignments.include.user.select).toMatchObject({
      profilePicture: true,
      emailHash: true,
      updatedAt: true,
      pronouns: true,
      email: true,
    })
  })

  it('demande les organisateurs affectés, avec leur photo', () => {
    const personne =
      inclusionCreneau.organizerAssignments.select.editionOrganizer.select.organizer.select.user
        .select

    expect(personne).toMatchObject({
      profilePicture: true,
      emailHash: true,
      updatedAt: true,
    })
  })

  it('ne demande PAS l’adresse des organisateurs', () => {
    const personne =
      inclusionCreneau.organizerAssignments.select.editionOrganizer.select.organizer.select.user
        .select

    expect(personne).not.toHaveProperty('email')
  })

  it('compte les bénévoles affectés', () => {
    expect(inclusionCreneau._count.select.assignments).toBe(true)
  })
})
