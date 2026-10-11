import { describe, it, expect } from 'vitest'

import {
  echapperIcs,
  genererIcs,
  replierLigne,
  type CreneauIcs,
} from '../../../../../layers/volunteers/app/utils/export-ics'

/**
 * L'export iCal du planning d'un bénévole — constat B6.
 *
 * ## ⚠️ POURQUOI CES CAS NE SONT PAS DU ZÈLE
 *
 * Un fichier d'agenda mal formé ne produit **aucune erreur chez nous** : le téléchargement
 * réussit, le bouton répond, et c'est l'agenda du bénévole qui refuse le fichier ou tronque un
 * créneau — trois jours plus tard, sans que personne ne fasse le lien. Chacun des défauts
 * ci-dessous était présent et invisible.
 */
const OPTIONS = {
  titreParDefaut: 'Créneau bénévole',
  libelleEquipe: 'Équipe :',
  // Figé : sinon `DTSTAMP` change à chaque exécution et les assertions deviennent instables.
  maintenant: new Date('2026-08-01T09:00:00Z'),
}

const creneau = (surcharge: Partial<CreneauIcs> = {}): CreneauIcs => ({
  id: 'slot-1',
  title: 'Bar du soir',
  startDateTime: '2026-08-01T18:00:00.000Z',
  endDateTime: '2026-08-01T22:00:00.000Z',
  ...surcharge,
})

const ligneDe = (ics: string, prefixe: string) =>
  ics.split('\r\n').find((l) => l.startsWith(prefixe))

describe('echapperIcs', () => {
  it('échappe la virgule, le point-virgule et l’antislash (RFC 5545 §3.3.11)', () => {
    expect(echapperIcs('Prévoir gants, gilet ; point B')).toBe('Prévoir gants\\, gilet \\; point B')
  })

  it('⚠️ L’ANTISLASH D’ABORD — sinon on double ceux qu’on vient d’introduire', () => {
    /*
     * Échapper la virgule puis l'antislash donnerait `a\\,b` : l'agenda afficherait l'antislash.
     * L'ordre des trois `replace` n'est donc pas indifférent, et ce cas le fige.
     */
    expect(echapperIcs('a,b')).toBe('a\\,b')
    expect(echapperIcs('C:\\chemin')).toBe('C:\\\\chemin')
  })

  it('transforme un VRAI retour à la ligne en séquence `\\n`', () => {
    // Sans cela, une description multiligne termine le VEVENT au milieu : tout ce qui suit dans
    // le fichier est perdu, en silence.
    expect(echapperIcs('ligne 1\nligne 2')).toBe('ligne 1\\nligne 2')
    expect(echapperIcs('ligne 1\r\nligne 2')).toBe('ligne 1\\nligne 2')
  })
})

describe('replierLigne', () => {
  it('laisse une ligne courte intacte', () => {
    expect(replierLigne('SUMMARY:Bar')).toBe('SUMMARY:Bar')
  })

  it('replie au-delà de 75 octets, avec une espace de continuation', () => {
    const repliee = replierLigne('SUMMARY:' + 'a'.repeat(100))
    const morceaux = repliee.split('\r\n')
    expect(morceaux.length).toBeGreaterThan(1)
    expect(morceaux[1]!.startsWith(' ')).toBe(true)
    // Recollé par le lecteur, le contenu doit être identique à l'original.
    expect(morceaux.map((m, i) => (i === 0 ? m : m.slice(1))).join('')).toBe(
      'SUMMARY:' + 'a'.repeat(100)
    )
  })

  it('⚠️ COMPTE EN OCTETS, PAS EN CARACTÈRES, et ne coupe pas un caractère en deux', () => {
    /*
     * C'EST LE CAS QUI COMMANDE L'IMPLÉMENTATION. « é » pèse DEUX octets en UTF-8 : replier à 75
     * caractères dépasserait la limite, et couper au milieu produirait un octet orphelin que
     * l'agenda refuse. Sur un planning français, les accents sont partout.
     */
    const repliee = replierLigne('SUMMARY:' + 'é'.repeat(60))
    const encodeur = new TextEncoder()
    for (const morceau of repliee.split('\r\n')) {
      expect(encodeur.encode(morceau).length).toBeLessThanOrEqual(75)
    }
    // Aucun caractère de remplacement : la preuve qu'aucun caractère n'a été scindé.
    expect(repliee).not.toContain('\uFFFD')
    expect(
      repliee
        .split('\r\n')
        .map((m, i) => (i === 0 ? m : m.slice(1)))
        .join('')
    ).toBe('SUMMARY:' + 'é'.repeat(60))
  })
})

describe('genererIcs', () => {
  it('⚠️ N’ÉCRIT JAMAIS « null » — le titre est NULLABLE en base', () => {
    /*
     * LE DÉFAUT D'ORIGINE, et le plus visible pour le bénévole : `SUMMARY:${slot.title}` sur un
     * titre nul exportait littéralement « null » dans son agenda. Le cas est COURANT — l'équipe
     * fait souvent office de nom de créneau.
     */
    const ics = genererIcs([creneau({ title: null, team: { name: 'Cuisine' } })], OPTIONS)

    expect(ics).not.toContain('null')
    // Le repli est le nom de l'ÉQUIPE : c'est ce que l'écran affiche à sa place.
    expect(ligneDe(ics, 'SUMMARY:')).toBe('SUMMARY:Cuisine')
  })

  it('retombe sur le libellé fourni quand il n’y a NI titre NI équipe', () => {
    // Le libellé vient de l'appelant : un mot français en dur dans l'util sortirait tel quel dans
    // l'agenda d'un lecteur allemand, et le défaut ne concernerait que lui.
    const ics = genererIcs([creneau({ title: null })], OPTIONS)

    expect(ligneDe(ics, 'SUMMARY:')).toBe('SUMMARY:Créneau bénévole')
  })

  it('échappe le titre, la description et le lieu', () => {
    const ics = genererIcs(
      [
        creneau({
          title: 'Bar, soir',
          description: 'Gants ; gilet',
          team: { name: 'Bar, salle B' },
        }),
      ],
      OPTIONS
    )

    expect(ligneDe(ics, 'SUMMARY:')).toBe('SUMMARY:Bar\\, soir')
    expect(ligneDe(ics, 'LOCATION:')).toBe('LOCATION:Bar\\, salle B')
    expect(ligneDe(ics, 'DESCRIPTION:')).toContain('Gants \\; gilet')
  })

  it('⚠️ NE DOUBLE PAS le séparateur VOULU entre équipe et description', () => {
    /*
     * La description est composée de morceaux échappés SÉPARÉMENT, puis recollés par la séquence
     * `\n` littérale. Échapper la chaîne déjà recollée transformerait ce séparateur en `\\n`, et
     * l'agenda afficherait « \n » au milieu du texte. C'est le piège de tout échappement appliqué
     * après composition — et il ne se voit pas dans le fichier, seulement à l'écran de l'agenda.
     */
    const ics = genererIcs(
      [creneau({ description: 'Prévoir des gants', team: { name: 'Bar' } })],
      OPTIONS
    )

    const description = ligneDe(ics, 'DESCRIPTION:')!
    expect(description).toBe('DESCRIPTION:Équipe : Bar\\nPrévoir des gants')
    expect(description).not.toContain('\\\\n')
  })

  it('applique le retard aux DEUX bornes', () => {
    // Le retard décale le début ET la fin : ne décaler que le début allongerait le créneau dans
    // l'agenda, ce qui est faux et plausible.
    const ics = genererIcs([creneau({ delayMinutes: 90 })], OPTIONS)

    expect(ligneDe(ics, 'DTSTART:')).toBe('DTSTART:20260801T193000Z')
    expect(ligneDe(ics, 'DTEND:')).toBe('DTEND:20260801T233000Z')
  })

  it('un retard NÉGATIF avance le créneau', () => {
    // Les bornes du retard acceptent le négatif (on avance un créneau) : un `if (delay > 0)`
    // l'ignorerait, et l'agenda annoncerait l'ancienne heure.
    const ics = genererIcs([creneau({ delayMinutes: -30 })], OPTIONS)

    expect(ligneDe(ics, 'DTSTART:')).toBe('DTSTART:20260801T173000Z')
  })

  it('n’émet ni DESCRIPTION ni LOCATION quand il n’y a rien à dire', () => {
    // Une ligne `DESCRIPTION:` vide est acceptée par certains agendas et refusée par d'autres :
    // ne pas l'écrire est la seule forme sûre.
    const ics = genererIcs([creneau()], OPTIONS)

    expect(ligneDe(ics, 'DESCRIPTION:')).toBeUndefined()
    expect(ligneDe(ics, 'LOCATION:')).toBeUndefined()
  })

  it('reste un calendrier bien formé avec plusieurs créneaux', () => {
    /*
     * LE TÉMOIN DE STRUCTURE : c'est précisément ce qu'un retour à la ligne non échappé cassait —
     * l'objet suivant devenait illisible, donc les créneaux d'APRÈS disparaissaient. Compter les
     * balises le dit, là où lire un seul créneau ne le dirait pas.
     */
    const ics = genererIcs(
      [
        creneau({ id: 'a', description: 'ligne 1\nligne 2' }),
        creneau({ id: 'b', title: 'Accueil' }),
      ],
      OPTIONS
    )

    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(2)
    expect(ics.split('END:VEVENT').length - 1).toBe(2)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('\r\nEND:VCALENDAR')).toBe(true)
    // Les lignes sont bien séparées par CRLF, comme l'exige la RFC — pas par un simple \n.
    expect(ics).not.toMatch(/[^\r]\n/)
  })
})
