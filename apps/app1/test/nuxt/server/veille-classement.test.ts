import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * L'appel au modèle est bouchonné au niveau du MODULE : `veille-classement` l'importe
 * explicitement, donc un bouchon posé sur une globale ne l'atteindrait pas. Et les `vi.mock`
 * doivent précéder l'import du module testé, d'où les `vi.hoisted`.
 */
const modele = vi.hoisted(() => ({ repondre: vi.fn() }))
vi.mock('#server/utils/appel-modele-texte', async () => {
  const vrai = await vi.importActual<typeof import('../../../server/utils/appel-modele-texte')>(
    '../../../server/utils/appel-modele-texte'
  )
  return {
    // `extraireJson` reste le VRAI : c'est lui qui encaisse la prose autour du JSON, et le
    // bouchonner reviendrait à ne plus éprouver le seul endroit qui lit la réponse du modèle.
    extraireJson: vrai.extraireJson,
    demanderAuModele: modele.repondre,
  }
})

import { classerLesCandidats, classerUnCandidat } from '../../../server/utils/veille-classement'

const prismaMock = (globalThis as any).prisma

/**
 * La classification automatique : ce qu'elle écrit, et surtout ce qu'elle N'ÉCRIT PAS.
 *
 * ## ⚠️ L'INVARIANT QUE CES CAS GARDENT
 *
 * L'avis du modèle ne doit JAMAIS atterrir dans `verdict`. Si cela arrivait, un balayage
 * automatique écraserait une décision humaine : un refus reviendrait au balayage suivant, soit
 * exactement ce que la fonctionnalité existe pour empêcher. Et le défaut serait **invisible** —
 * les lignes seraient à jour, plausibles, et personne ne saurait que son refus a sauté.
 *
 * Le second invariant : l'avis TRIE, il ne MASQUE pas. Un candidat jugé hors sujet reste
 * `A_EXAMINER`, donc rattrapable. Une convention mal classée qui disparaîtrait serait le défaut le
 * plus coûteux ici : jamais importée, et personne ne sait qu'elle a été écartée.
 */
const candidat = (surcharges: Record<string, unknown> = {}) => ({
  url: 'https://jugglingedge.com/event.php?EventID=6485',
  titre: 'Jonglierfestival Freiburg',
  pays: 'Allemagne',
  lieu: 'Fribourg',
  debut: new Date('2026-11-20T00:00:00Z'),
  jours: 3,
  ...surcharges,
})

describe('classerUnCandidat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lit l’avis et le motif d’une réponse JSON', async () => {
    modele.repondre.mockResolvedValue(
      '{"avis":"CONVENTION","motif":"Festival de jonglerie annuel"}'
    )

    const resultat = await classerUnCandidat(candidat(), {})

    expect(resultat).toEqual({ avis: 'CONVENTION', motif: 'Festival de jonglerie annuel' })
  })

  it('📍 encaisse la PROSE autour du JSON', async () => {
    /*
     * Les modèles encadrent volontiers leur réponse — « Voici le résultat : … » — ou l'entourent
     * de balises de bloc de code. Un `JSON.parse` direct échouerait sur une réponse pourtant
     * correcte, et le candidat serait compté « illisible » à tort : on paierait un appel pour rien
     * et il faudrait le refaire.
     */
    modele.repondre.mockResolvedValue(
      'Voici mon analyse :\n```json\n{"avis":"HORS_SUJET","motif":"Spectacle de cirque"}\n```\nVoilà.'
    )

    const resultat = await classerUnCandidat(candidat(), {})

    expect(resultat?.avis).toBe('HORS_SUJET')
  })

  it('⚠️ rend `null` sur un avis HORS de l’énumération, plutôt qu’une valeur de repli', async () => {
    /*
     * LE cas. Un repli — `INCERTAIN` par défaut, par exemple — inventerait un avis que le modèle
     * n'a pas donné, et il serait rangé en base comme s'il venait de lui. `null` fait que rien
     * n'est écrit : `avisIa` reste `NULL`, ce qui dit « pas encore classé » — et c'est vrai.
     */
    modele.repondre.mockResolvedValue('{"avis":"PEUT_ETRE","motif":"bof"}')

    expect(await classerUnCandidat(candidat(), {})).toBe(null)
  })

  it('rend `null` sur une réponse sans JSON du tout', async () => {
    modele.repondre.mockResolvedValue('Je ne peux pas répondre à cette demande.')

    expect(await classerUnCandidat(candidat(), {})).toBe(null)
  })

  it('📍 garde l’avis même SANS motif, plutôt que de jeter une classification correcte', async () => {
    modele.repondre.mockResolvedValue('{"avis":"CONVENTION"}')

    const resultat = await classerUnCandidat(candidat(), {})

    expect(resultat?.avis).toBe('CONVENTION')
    expect(resultat?.motif).toBe('—')
  })

  it('📍 soumet au modèle le PAYS et la DURÉE, pas seulement le titre', async () => {
    /*
     * Sans eux, un titre comme « Festival des Arts du Cirque » devient indécidable, et le modèle
     * tranche au hasard. Le pays et la durée sont ce qui distingue un rassemblement de trois jours
     * d'un spectacle d'une soirée.
     */
    modele.repondre.mockResolvedValue('{"avis":"INCERTAIN","motif":"ambigu"}')

    await classerUnCandidat(candidat(), {})

    const promptUtilisateur = modele.repondre.mock.calls[0][1] as string
    expect(promptUtilisateur).toContain('Allemagne')
    expect(promptUtilisateur).toContain('3 jour')
    expect(promptUtilisateur).toContain('Jonglierfestival Freiburg')
  })
})

describe('classerLesCandidats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.candidatEvenement.findMany.mockResolvedValue([candidat()])
    prismaMock.candidatEvenement.update.mockResolvedValue({})
  })

  it('⚠️ N’ÉCRIT JAMAIS `verdict` — seulement l’avis, sa date et son motif', async () => {
    /*
     * L'invariant du module entier. Un `data` qui porterait `verdict` laisserait une relance
     * automatique écraser un refus humain, et le refus reviendrait au balayage suivant.
     */
    modele.repondre.mockResolvedValue('{"avis":"HORS_SUJET","motif":"Spectacle"}')

    await classerLesCandidats(10, {})

    const appel = prismaMock.candidatEvenement.update.mock.calls[0][0]
    expect(appel.data).not.toHaveProperty('verdict')
    expect(appel.data).not.toHaveProperty('verdictLe')
    expect(Object.keys(appel.data).sort()).toEqual(['avisIa', 'avisIaLe', 'motifIa'])
    expect(appel.where).toEqual({ url: candidat().url })
  })

  it('⚠️ ne prend QUE les candidats à examiner que le modèle n’a pas vus', async () => {
    /*
     * Deux raisons, et les deux coûtent de l'argent si on les rate : soumettre un candidat déjà
     * tranché par un humain paie pour une information dont personne ne se servira, et resoumettre
     * un candidat déjà classé refacture le même appel à chaque balayage.
     */
    modele.repondre.mockResolvedValue('{"avis":"CONVENTION","motif":"ok"}')

    await classerLesCandidats(10, {})

    const where = prismaMock.candidatEvenement.findMany.mock.calls[0][0].where
    expect(where).toEqual({ verdict: 'A_EXAMINER', avisIa: null })
  })

  it('📍 respecte la limite d’appels demandée', async () => {
    modele.repondre.mockResolvedValue('{"avis":"CONVENTION","motif":"ok"}')

    await classerLesCandidats(7, {})

    expect(prismaMock.candidatEvenement.findMany.mock.calls[0][0].take).toBe(7)
  })

  it('⚠️ un échec sur un candidat n’interrompt pas les autres, et il est COMPTÉ', async () => {
    /*
     * Sans ce comportement, un modèle momentanément injoignable rendrait « 0 classé » — ce qui se
     * lit « il n'y avait rien à faire », et c'est faux. Le compte rendu doit distinguer.
     */
    prismaMock.candidatEvenement.findMany.mockResolvedValue([
      candidat({ url: 'https://a.test/1' }),
      candidat({ url: 'https://a.test/2' }),
      candidat({ url: 'https://a.test/3' }),
    ])
    modele.repondre
      .mockResolvedValueOnce('{"avis":"CONVENTION","motif":"ok"}')
      .mockRejectedValueOnce(new Error('modèle injoignable'))
      .mockResolvedValueOnce('{"avis":"INCERTAIN","motif":"doute"}')

    const bilan = await classerLesCandidats(10, {})

    expect(bilan.soumis).toBe(3)
    expect(bilan.classes).toBe(2)
    expect(bilan.echecs).toBe(1)
    expect(bilan.premiereErreur).toContain('injoignable')
    // Le témoin : les deux candidats sains ont bien été rangés malgré l'échec du deuxième.
    expect(prismaMock.candidatEvenement.update).toHaveBeenCalledTimes(2)
    expect(bilan.parAvis).toEqual({ CONVENTION: 1, HORS_SUJET: 0, INCERTAIN: 1 })
  })

  it('⚠️ compte les ILLISIBLES à part, et n’écrit rien pour eux', async () => {
    /*
     * « Le modèle a répondu hors format » et « le modèle n'a pas répondu » n'appellent pas la même
     * réaction : l'un se corrige dans le prompt, l'autre dans l'infrastructure. Les confondre
     * enverrait chercher la panne du mauvais côté.
     */
    modele.repondre.mockResolvedValue('{"avis":"JE_NE_SAIS_PAS"}')

    const bilan = await classerLesCandidats(10, {})

    expect(bilan.illisibles).toBe(1)
    expect(bilan.echecs).toBe(0)
    expect(bilan.classes).toBe(0)
    expect(prismaMock.candidatEvenement.update).not.toHaveBeenCalled()
  })
})
