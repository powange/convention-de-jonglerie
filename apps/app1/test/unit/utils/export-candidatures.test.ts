import { describe, expect, it } from 'vitest'

import { BOM_UTF8 } from '../../../shared/utils/csv'
import {
  candidaturesEnCsv,
  COLONNES_A_IMPRIMER,
  COLONNES_CANDIDATURES,
  entetesDesCandidatures,
  ligneDUneCandidature,
  momentLisible,
  ouiAvecDetail,
  regimeLisible,
  statutLisible,
  type CandidatureExportable,
} from '../../../../../layers/volunteers/app/utils/export-candidatures'

/**
 * Le fichier des candidatures de bénévoles.
 *
 * Il s'écrivait sur le serveur, avec vingt-six en-têtes et toutes ses valeurs en français dans le
 * code. Ce qui se vérifie ici, c'est qu'il ne reste plus un seul mot figé : chaque libellé et
 * chaque valeur passent par une clé de traduction.
 *
 * D'où le traducteur d'essai ci-dessous, qui rend la CLÉ plutôt qu'un texte. Un `t` renvoyant du
 * français aurait laissé passer exactement le défaut qu'on répare — on n'aurait pas vu la
 * différence entre « traduit » et « écrit en dur ».
 */
const t = (cle: string) => `[${cle}]`
const FORMAT = { locale: 'fr-FR', fuseau: 'Europe/Paris' }

const candidature = (champs: Partial<CandidatureExportable> = {}): CandidatureExportable => ({
  createdAt: '2026-08-01T10:00:00Z',
  status: 'ACCEPTED',
  user: { pseudo: 'alice', prenom: 'Alice', nom: 'Martin', email: 'a@x.fr', phone: '+33612345678' },
  ...champs,
})

describe('entetesDesCandidatures', () => {
  it('rend AUTANT d’en-têtes que la ligne a de cellules', () => {
    // Le décalage d'un cran entre en-têtes et valeurs est le défaut qui guette un fichier écrit
    // en deux listes parallèles : il ne lève rien, il décale juste toutes les colonnes.
    const entetes = entetesDesCandidatures(t)
    expect(entetes).toHaveLength(COLONNES_CANDIDATURES.length)
    expect(ligneDUneCandidature(candidature(), t, FORMAT)).toHaveLength(entetes.length)
  })

  it('ne laisse AUCUN libellé en dur : tous passent par une clé', () => {
    // Le cœur du correctif. Avec un traducteur qui rend la clé, tout en-tête qui ressortirait en
    // clair serait un libellé oublié dans le code.
    for (const entete of entetesDesCandidatures(t)) {
      expect(entete).toMatch(/^\[.+\]$/)
    }
  })

  it('emploie les clés des colonnes de l’écran', () => {
    // Le fichier doit parler avec les mots que l'utilisateur vient de lire dans le tableau.
    const cles = COLONNES_CANDIDATURES.map((c) => c.cle)
    expect(cles).toContain('volunteers.table_user')
    expect(cles).toContain('volunteers.table_motivation')
    expect(cles).toContain('common.status')
  })
})

describe('les valeurs se traduisent aussi', () => {
  it('traduit les trois statuts', () => {
    expect(statutLisible('PENDING', t)).toBe('[volunteers.status_pending]')
    expect(statutLisible('ACCEPTED', t)).toBe('[volunteers.status_accepted]')
    expect(statutLisible('REJECTED', t)).toBe('[volunteers.status_rejected]')
  })

  it('rend un statut INCONNU tel quel plutôt que vide', () => {
    // Une valeur qu'on ne sait pas nommer reste plus utile qu'une cellule muette.
    expect(statutLisible('ARCHIVED', t)).toBe('ARCHIVED')
    expect(statutLisible(null, t)).toBe('')
  })

  it('traite `NONE` comme une VALEUR et non comme une absence', () => {
    // « Aucun régime » est une réponse ; la confondre avec « pas de réponse » ferait disparaître
    // une information que le bénévole a bel et bien donnée.
    expect(regimeLisible('NONE', t)).toBe('[diet.none]')
    expect(regimeLisible(null, t)).toBe('')
  })

  it('traduit oui et non, avec le détail entre parenthèses', () => {
    expect(ouiAvecDetail(true, 'un chien', t)).toBe('[common.yes] (un chien)')
    expect(ouiAvecDetail(true, null, t)).toBe('[common.yes]')
    expect(ouiAvecDetail(true, '   ', t)).toBe('[common.yes]')
    expect(ouiAvecDetail(false, 'un chien', t)).toBe('[common.no]')
  })
})

describe('momentLisible', () => {
  it('rend un JOUR et un MOMENT, sans inventer d’heure', () => {
    // Le bénévole a dit « le 14 au matin ». Lui répondre « 14/08/2026 00:00 » inventerait une
    // précision qu'il n'a pas donnée.
    expect(momentLisible('2026-08-14_morning', t, FORMAT)).toBe(
      '14 août [edition.volunteers.time_granularity.morning]'
    )
  })

  it('traduit les quatre moments de la journée', () => {
    for (const [code, cle] of [
      ['morning', 'morning'],
      ['noon', 'noon'],
      ['afternoon', 'afternoon'],
      ['evening', 'evening'],
    ]) {
      expect(momentLisible(`2026-08-14_${code}`, t, FORMAT)).toContain(
        `[edition.volunteers.time_granularity.${cle}]`
      )
    }
  })

  it('rend une valeur MAL FORMÉE telle quelle plutôt que vide', () => {
    // Sur une information qui sert à organiser un accueil, un texte brut vaut mieux qu'un blanc.
    expect(momentLisible('samedi soir', t, FORMAT)).toBe('samedi soir')
    expect(momentLisible('pasunedate_morning', t, FORMAT)).toBe('pasunedate morning')
  })

  it('rend une chaîne vide pour une absence', () => {
    expect(momentLisible('', t, FORMAT)).toBe('')
    expect(momentLisible(null, t, FORMAT)).toBe('')
  })
})

describe('candidaturesEnCsv', () => {
  it('commence par la marque d’ordre des octets', () => {
    // Sans elle, Excel sous Windows lit « Prénom » en « PrÃ©nom » sur toute la colonne.
    expect(candidaturesEnCsv([candidature()], t, FORMAT).startsWith(BOM_UTF8)).toBe(true)
  })

  it('NEUTRALISE une motivation qui commence par un signe égal', () => {
    // Du texte saisi par un candidat, exécuté à l'ouverture du fichier chez l'organisateur.
    const csv = candidaturesEnCsv([candidature({ motivation: '=cmd|/c calc' })], t, FORMAT)
    expect(csv).toContain(`"'=cmd|/c calc"`)
  })

  it('laisse INTACT un numéro de téléphone international', () => {
    // 144 des 202 numéros en base commencent par « + » : les marquer serait pire que le mal.
    expect(candidaturesEnCsv([candidature()], t, FORMAT)).toContain('"+33612345678"')
  })

  it('garde une virgule dans sa cellule', () => {
    const csv = candidaturesEnCsv(
      [candidature({ motivation: 'Bonjour, je suis dispo le samedi' })],
      t,
      FORMAT
    )
    expect(csv).toContain('"Bonjour, je suis dispo le samedi"')
  })

  it('sépare les lignes par CRLF', () => {
    expect(candidaturesEnCsv([candidature()], t, FORMAT).split('\r\n')).toHaveLength(2)
  })

  it('tient debout sur une candidature vide de tout', () => {
    // Les droits de qui exporte font varier ce que le serveur rend : une colonne absente doit
    // donner une cellule vide, pas faire tomber l'export.
    const ligne = ligneDUneCandidature({}, t, FORMAT)
    expect(ligne).toHaveLength(COLONNES_CANDIDATURES.length)
    expect(ligne[2]).toBe('')
  })

  it('rend un fichier d’en-têtes seuls quand il n’y a personne', () => {
    const csv = candidaturesEnCsv([], t, FORMAT)
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(1)
  })
})

describe('les heures suivent le fuseau de l’édition', () => {
  it('écrit une candidature du soir au bon JOUR selon le lieu', () => {
    // Déposée le 1er août à 23 h 30 UTC : c'est déjà le 2 à Paris, et encore le 1er à Montréal.
    // Sans fuseau, une convention canadienne daterait ses candidatures du lendemain.
    const tardive = candidature({ createdAt: '2026-08-01T23:30:00Z' })

    const paris = ligneDUneCandidature(tardive, t, { locale: 'fr-FR', fuseau: 'Europe/Paris' })[0]
    const montreal = ligneDUneCandidature(tardive, t, {
      locale: 'fr-FR',
      fuseau: 'America/Montreal',
    })[0]

    expect(paris).toContain('02/08/2026')
    expect(montreal).toContain('01/08/2026')
  })

  it('rend une chaîne vide sur une date illisible', () => {
    expect(ligneDUneCandidature(candidature({ createdAt: 'n’importe quoi' }), t, FORMAT)[0]).toBe(
      ''
    )
  })
})

/**
 * Le sous-ensemble imprimé.
 *
 * Vingt-six colonnes ne tiennent pas sur une feuille. Ce qui se vérifie ici n'est pas le choix des
 * colonnes — c'est un jugement, pas une règle — mais l'invariant qui le rend sûr : en-tête et
 * valeur ne peuvent pas se décaler, y compris sur une sélection partielle.
 */
describe('la sélection de colonnes pour le papier', () => {
  it('rend autant d’en-têtes que de cellules, sur le sous-ensemble aussi', () => {
    const entetes = entetesDesCandidatures(t, COLONNES_A_IMPRIMER)
    expect(entetes).toHaveLength(COLONNES_A_IMPRIMER.length)
    expect(ligneDUneCandidature(candidature(), t, FORMAT, COLONNES_A_IMPRIMER)).toHaveLength(
      entetes.length
    )
  })

  it('aligne chaque valeur sur SON en-tête, et pas sur la voisine', () => {
    // Le défaut que ce découpage pourrait introduire : deux listes parallèles filtrées
    // séparément décalent tout d'un cran, sans rien lever.
    const entetes = entetesDesCandidatures(t, ['pseudo', 'phone'])
    const ligne = ligneDUneCandidature(candidature(), t, FORMAT, ['pseudo', 'phone'])

    expect(entetes).toEqual(['[volunteers.table_user]', '[common.phone]'])
    expect(ligne).toEqual(['alice', '+33612345678'])
  })

  it('suit l’ordre du CATALOGUE, pas celui de la demande', () => {
    // Un seul ordre possible évite qu'un appelant compose un tableau dont les colonnes ne sont
    // pas dans le même ordre qu'ailleurs.
    expect(entetesDesCandidatures(t, ['phone', 'pseudo'])).toEqual(
      entetesDesCandidatures(t, ['pseudo', 'phone'])
    )
  })

  it('rend TOUTES les colonnes sans sélection', () => {
    expect(entetesDesCandidatures(t)).toHaveLength(COLONNES_CANDIDATURES.length)
    expect(entetesDesCandidatures(t, [])).toHaveLength(COLONNES_CANDIDATURES.length)
  })

  it('n’imprime que des colonnes qui existent', () => {
    // Une coquille dans la liste ferait une colonne muette sur la feuille.
    const connues = new Set(COLONNES_CANDIDATURES.map((c) => c.id))
    for (const id of COLONNES_A_IMPRIMER) {
      expect(connues.has(id)).toBe(true)
    }
  })

  it('tient sur une page : pas plus d’une douzaine de colonnes', () => {
    // Le seuil n'est pas magique, il est mesuré : au-delà, le paysage ne suffit plus et la
    // police devient illisible — or une feuille illisible ne sert à rien.
    expect(COLONNES_A_IMPRIMER.length).toBeLessThanOrEqual(12)
  })

  it('emporte de quoi APPELER et de quoi NOURRIR', () => {
    // Les deux usages du papier au guichet. Si quelqu'un allège la liste un jour, que ce soit en
    // sachant ce qu'il retire.
    expect(COLONNES_A_IMPRIMER).toContain('phone')
    expect(COLONNES_A_IMPRIMER).toContain('allergies')
    expect(COLONNES_A_IMPRIMER).toContain('diet')
  })
})
