import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import {
  etatVideDesObjets,
  STATUT_RESTITUE,
} from '../../../../../layers/lost-found/app/utils/etat-vide-des-objets'

/**
 * « Tout a été restitué » n'est pas « rien n'a été signalé » — constat F3.
 *
 * Les objets restitués sont masqués par défaut : les deux situations produisent donc la MÊME liste
 * vide, et c'est tout le piège. L'écran annonçait « Aucun objet n'a été signalé pour cette
 * édition » dans les deux cas, alors que dans le premier la liste est pleine.
 *
 * 📍 La règle est extraite ici, en fonction pure, plutôt qu'éprouvée en montant la page : celle-ci
 * demande le magasin des éditions, l'authentification et cinq appels d'API, et ce qui est en cause
 * se décide entièrement dans ces quelques lignes. Le gabarit ne fait que les lire.
 */
const objet = (status: string | null = null) => ({ status })

describe('objets trouvés — lequel des deux vides', () => {
  it('rien du tout : rien n’a été signalé', () => {
    expect(etatVideDesObjets([], false)).toBe('rien-signale')
  })

  it('tout restitué, filtre baissé : tout a été restitué', () => {
    // 📍 LE CŒUR DU CONSTAT. C'est ce cas-ci qui annonçait « rien n'a été signalé ».
    expect(etatVideDesObjets([objet(STATUT_RESTITUE), objet(STATUT_RESTITUE)], false)).toBe(
      'tout-restitue'
    )
  })

  it('tout restitué mais filtre levé : il y a quelque chose à afficher', () => {
    // Le filtre lève le masque : la liste n'est plus vide, donc il n'y a aucun état vide à rendre.
    expect(etatVideDesObjets([objet(STATUT_RESTITUE)], true)).toBe('aucun')
  })

  it('un objet encore perdu : il y a quelque chose à afficher', () => {
    expect(etatVideDesObjets([objet('LOST')], false)).toBe('aucun')
  })

  it('un perdu parmi des restitués : il y a quelque chose à afficher', () => {
    expect(etatVideDesObjets([objet(STATUT_RESTITUE), objet('LOST')], false)).toBe('aucun')
  })

  it('une liste vide avec le filtre levé reste « rien signalé »', () => {
    // Lever le filtre ne crée pas d'objets : les deux réponses doivent concorder sur une liste
    // vide, sans quoi le message dépendrait d'un bouton plutôt que des données.
    expect(etatVideDesObjets([], true)).toBe('rien-signale')
  })

  it('un statut inconnu reste visible, donc il n’y a pas d’état vide', () => {
    // ⚠️ CE CAS N'ÉPROUVE PAS LE `some` DE LA FONCTION, contrairement à ce que j'avais d'abord
    // écrit : l'objet n'étant pas restitué, il est visible, et la réponse sort bien avant. Le
    // sabotage l'a prouvé — `some` remplacé par `length > 0`, tous les cas restaient verts. Voir
    // le commentaire de la fonction : les deux écritures sont équivalentes tant que le filtre des
    // restitués est le seul.
    expect(etatVideDesObjets([objet('EN_ATTENTE_DE_RETRAIT')], false)).toBe('aucun')
  })

  it('un statut absent compte comme non restitué', () => {
    // La donnée vient de l'API : un champ manquant ne doit pas basculer le message.
    expect(etatVideDesObjets([objet(null)], false)).toBe('aucun')
    expect(etatVideDesObjets([{}], false)).toBe('aucun')
  })
})

/**
 * ⚠️⚠️ ET LA FONCTION EST-ELLE BRANCHÉE ? Les huit cas ci-dessus seraient tous verts sur une
 * fonction que PERSONNE N'APPELLE — c'est le motif « util écrit, testé, jamais branché », payé
 * cinq fois dans ce dépôt, et la couverture fait précisément passer ce code mort pour vivant.
 */
const RACINE = path.resolve(__dirname, '../../../../..')
const PAGE = 'layers/lost-found/app/pages/editions/[id]/lost-found/index.vue'

describe('objets trouvés — la règle est bien celle que la page applique', () => {
  const code = () => fs.readFileSync(path.resolve(RACINE, PAGE), 'utf8')

  it('la page appelle la fonction', () => {
    expect(code()).toContain('etatVideDesObjets(lostFoundItems.value, showReturned.value)')
  })

  it('le ternaire aux deux branches identiques a disparu', () => {
    // La signature exacte du défaut : `no_items_reported` rendu des DEUX côtés du ternaire.
    const occurrences = code().match(/edition\.no_items_reported/g) ?? []
    expect(occurrences).toHaveLength(1)
  })

  it('le gabarit distingue les deux messages', () => {
    const c = code()
    expect(c).toContain("edition.all_items_returned'")
    expect(c).toContain('edition.all_items_returned_description')
  })

  it('les deux clés existent en français', () => {
    const fr = JSON.parse(
      fs.readFileSync(path.resolve(RACINE, 'apps/app1/i18n/locales/fr/common.json'), 'utf8')
    )
    expect(fr.edition.all_items_returned).toBeTruthy()
    expect(fr.edition.all_items_returned_description).toBeTruthy()
  })
})
