import { describe, expect, it } from 'vitest'

import {
  CHAMPS_DE_TRI,
  construireRequeteUrl,
  DEFAULT_PAGE_SIZE,
  FILTER_DEFAULTS,
  lireEtatDepuisUrl,
  TRI_PAR_DEFAUT,
  type EtatDuJournal,
} from '../../../app/utils/filtres-error-logs'

const MASQUABLES = [
  'createdAt',
  'statusCode',
  'errorType',
  'endpoint',
  'message',
  'user',
  'referer',
  'ip',
]

/** L'état d'arrivée de l'écran : rien à écrire dans l'URL. */
const etatDeDepart = (): EtatDuJournal => ({
  filtres: { ...FILTER_DEFAULTS },
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  vueGroupee: true,
  tri: { ...TRI_PAR_DEFAUT },
  visibiliteDesColonnes: {},
})

describe('construireRequeteUrl', () => {
  it("n'écrit rien quand tout est à son défaut", () => {
    expect(construireRequeteUrl(etatDeDepart())).toEqual({})
  })

  it('écrit la vue à plat, jamais la vue groupée', () => {
    expect(construireRequeteUrl({ ...etatDeDepart(), vueGroupee: false })).toEqual({ vue: 'plate' })
    expect(construireRequeteUrl({ ...etatDeDepart(), vueGroupee: true })).toEqual({})
  })

  it("n'écrit du tri que ce qui s'écarte du défaut", () => {
    const etat = etatDeDepart()
    expect(construireRequeteUrl({ ...etat, tri: { field: 'statusCode', dir: 'desc' } })).toEqual({
      tri: 'statusCode',
    })
    expect(construireRequeteUrl({ ...etat, tri: { field: 'createdAt', dir: 'asc' } })).toEqual({
      triDir: 'asc',
    })
  })

  it('écrit les colonnes masquées, triées, et ignore les visibles', () => {
    const etat = {
      ...etatDeDepart(),
      visibiliteDesColonnes: { referer: false, ip: true, user: false },
    }
    expect(construireRequeteUrl(etat)).toEqual({ colonnes: 'referer,user' })
  })

  it('cumule filtres, pagination, vue, tri et colonnes', () => {
    const etat: EtatDuJournal = {
      filtres: { ...FILTER_DEFAULTS, status: 'resolved', path: '/api/editions' },
      page: 3,
      pageSize: 50,
      vueGroupee: false,
      tri: { field: 'path', dir: 'asc' },
      visibiliteDesColonnes: { ip: false },
    }
    expect(construireRequeteUrl(etat)).toEqual({
      status: 'resolved',
      path: '/api/editions',
      page: '3',
      pageSize: '50',
      vue: 'plate',
      tri: 'path',
      triDir: 'asc',
      colonnes: 'ip',
    })
  })
})

describe('lireEtatDepuisUrl', () => {
  it('ne rend rien pour une URL vide : l’appelant garde ses défauts', () => {
    expect(lireEtatDepuisUrl({}, MASQUABLES)).toEqual({})
  })

  it('relit la vue à plat', () => {
    expect(lireEtatDepuisUrl({ vue: 'plate' }, MASQUABLES).vueGroupee).toBe(false)
    expect(lireEtatDepuisUrl({ vue: 'groupee' }, MASQUABLES).vueGroupee).toBe(true)
  })

  /*
   * Un champ inventé ferait échouer le chargement côté API, sur une URL qu'on a pu partager :
   * on retombe sur le défaut plutôt que de le transmettre.
   */
  it('ignore un champ de tri que l’API ne connaît pas', () => {
    expect(lireEtatDepuisUrl({ tri: 'motDePasse' }, MASQUABLES).tri).toBeUndefined()
    expect(lireEtatDepuisUrl({ tri: 'motDePasse', triDir: 'asc' }, MASQUABLES).tri).toEqual({
      field: TRI_PAR_DEFAUT.field,
      dir: 'asc',
    })
  })

  it('accepte les trois champs que l’API supporte', () => {
    for (const champ of CHAMPS_DE_TRI) {
      expect(lireEtatDepuisUrl({ tri: champ }, MASQUABLES).tri?.field).toBe(champ)
    }
  })

  /*
   * Sans cette borne, une URL bricolée ferait disparaître la colonne d'actions ou celle du statut,
   * que l'écran ne propose justement pas de masquer.
   */
  it('ne masque que les colonnes que l’écran propose de masquer', () => {
    const etat = lireEtatDepuisUrl({ colonnes: 'ip,actions,status,referer' }, MASQUABLES)
    expect(etat.visibiliteDesColonnes).toEqual({ ip: false, referer: false })
  })

  it('relit les filtres et la pagination', () => {
    const etat = lireEtatDepuisUrl({ status: 'resolved', page: '4', pageSize: '100' }, MASQUABLES)
    expect(etat.filtres).toEqual({ status: 'resolved' })
    expect(etat.page).toBe(4)
    expect(etat.pageSize).toBe(100)
  })

  it('ignore une page qui n’en est pas une', () => {
    expect(lireEtatDepuisUrl({ page: 'zéro' }, MASQUABLES).page).toBeUndefined()
    expect(lireEtatDepuisUrl({ page: '0' }, MASQUABLES).page).toBeUndefined()
  })
})

/**
 * L'aller-retour est ce que le lecteur constate : il règle son écran, recharge, et retrouve
 * exactement ce qu'il avait.
 */
describe('aller-retour', () => {
  it('restitue un état complet après passage par l’URL', () => {
    const etat: EtatDuJournal = {
      filtres: { ...FILTER_DEFAULTS, status: 'resolved', errorType: 'ValidationError' },
      page: 2,
      pageSize: 50,
      vueGroupee: false,
      tri: { field: 'statusCode', dir: 'asc' },
      visibiliteDesColonnes: { ip: false, referer: false },
    }

    const relu = lireEtatDepuisUrl(construireRequeteUrl(etat), MASQUABLES)

    expect(relu.vueGroupee).toBe(false)
    expect(relu.tri).toEqual({ field: 'statusCode', dir: 'asc' })
    expect(relu.visibiliteDesColonnes).toEqual({ ip: false, referer: false })
    expect(relu.page).toBe(2)
    expect(relu.pageSize).toBe(50)
    expect(relu.filtres).toEqual({ status: 'resolved', errorType: 'ValidationError' })
  })
})
