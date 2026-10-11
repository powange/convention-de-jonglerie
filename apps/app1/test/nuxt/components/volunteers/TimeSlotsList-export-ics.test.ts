import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TimeSlotsList from '../../../../../../layers/volunteers/app/components/volunteers/TimeSlotsList.vue'

/**
 * Le BRANCHEMENT de l'export iCal — constat B6.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE, alors que l'util est déjà couvert par 14 cas
 *
 * `export-ics.ts` est éprouvé à part, et c'est là que vivent les règles. Mais **un util juste et
 * branché nulle part ne corrige rien** : ce dépôt a payé ce défaut cinq fois, et la couverture du
 * code mort le fait passer pour vivant. Ce qui se vérifie ici est donc uniquement le câblage —
 * que le clic produise bien un fichier, construit par cet util, avec le bon nom.
 *
 * ## Ce qu'il fallait contourner
 *
 * `URL.createObjectURL` n'existe pas dans jsdom, et le téléchargement passe par un `<a>` cliqué.
 * On remplace donc les deux, et **on capture le contenu du `Blob`** : c'est le seul endroit où le
 * fichier réellement produit est observable.
 */
const CRENEAU_SANS_TITRE = {
  id: 'creneau-1',
  // ⚠️ `null`, le cas d'origine du défaut : l'export écrivait littéralement « null ».
  title: null,
  description: 'Prévoir gants, gilet',
  startDateTime: '2026-10-02T12:00:00.000Z',
  endDateTime: '2026-10-02T14:00:00.000Z',
  delayMinutes: null,
  team: { id: 'accueil', name: 'Accueil', color: '#3b82f6' },
}

let monte: { unmount: () => void } | null = null
let contenu = ''
let nomPropose = ''

/**
 * Recolle les lignes repliées, comme le fait l'agenda qui lit le fichier.
 *
 * ⚠️ INDISPENSABLE POUR ASSERTER UN TEXTE, et la raison est instructive : l'environnement de test
 * est en ANGLAIS, donc une clé i18n NEUVE — créée en français seulement — ressort BRUTE
 * (« pages.volunteers.export_ics_team_prefix »). Elle allonge la ligne au point de déclencher le
 * repli à 75 octets, et un `toContain` sur le texte échoue alors sur la coupure, pas sur
 * l'échappement. Le défaut serait imputé au mauvais endroit.
 */
const deplier = (ics: string) => ics.replace(/\r\n /g, '')

beforeEach(() => {
  contenu = ''
  nomPropose = ''
  // Le Blob est l'unique prise sur le fichier produit : on lit son texte au moment de sa création.
  vi.stubGlobal(
    'Blob',
    // Une FONCTION et non une classe : ESLint refuse une classe réduite à son constructeur
    // (`no-extraneous-class`), et `new` sur une fonction convient tout aussi bien ici.
    function FauxBlob(this: unknown, parties: string[]) {
      contenu = parties.join('')
    }
  )
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:faux')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  // Le clic du lien déclencherait une navigation que jsdom signale : on l'intercepte, et on en
  // profite pour relever le nom de fichier proposé.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLElement) {
    nomPropose = (this as HTMLAnchorElement).download
  })
})

afterEach(() => {
  monte?.unmount()
  monte = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const exporter = async () => {
  const wrapper = await mountSuspended(TimeSlotsList, {
    props: {
      timeSlots: [CRENEAU_SANS_TITRE],
      // ⚠️ `showStats` est OBLIGATOIRE : les boutons d'export vivent dans le bloc de
      // statistiques, rendu sous ce drapeau. Sans lui le bouton n'existe pas, et mon premier
      // essai échouait sur « bouton introuvable » — l'assertion nommée a dit la cause tout de
      // suite, là qu'un `click` sur `undefined` aurait accusé le composant.
      showStats: true,
      fuseau: 'Europe/Paris',
      editionName: 'EJC 2026 / Lyon',
      volunteerName: 'Camille Müller',
    },
  })
  monte = wrapper

  const bouton = wrapper
    .findAll('button')
    .find((b) => b.text().toLowerCase().includes('ical') || b.text().toLowerCase().includes('ics'))
  expect(bouton, 'le bouton d’export iCal est introuvable').toBeTruthy()
  await bouton!.trigger('click')
  return wrapper
}

describe('TimeSlotsList — export iCal', () => {
  it('⚠️ PRODUIT UN FICHIER QUI NE CONTIENT PAS « null »', async () => {
    await exporter()

    expect(contenu).toContain('BEGIN:VCALENDAR')
    expect(contenu).not.toContain('null')
    // Le repli est le nom de l'équipe, comme l'écran l'affiche à la place du titre.
    expect(contenu).toContain('SUMMARY:Accueil')
  })

  it('passe bien par l’util : la description est ÉCHAPPÉE', async () => {
    /*
     * L'assertion qui prouve le câblage, et pas seulement qu'un fichier sort. La virgule échappée
     * ne peut venir que de `echapperIcs` : l'ancienne composition en ligne écrivait le texte tel
     * quel.
     */
    await exporter()

    expect(deplier(contenu)).toContain('Prévoir gants\\, gilet')
  })

  it('⚠️ LE NOM DU FICHIER EST ASSAINI, barre oblique et accents compris', async () => {
    /*
     * L'ancien nom venait de `editionName.toLowerCase().replace(/\s+/g, '-')` : une édition
     * nommée « EJC 2026 / Lyon » produisait un nom contenant un SÉPARATEUR DE CHEMIN, et les
     * accents y restaient. Le PDF voisin assainissait déjà ; les deux partagent désormais la
     * même règle.
     */
    await exporter()

    expect(nomPropose).toBe('planning-ejc-2026-lyon-camille-muller.ics')
    expect(nomPropose).not.toContain('/')
  })
})
