import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Tout script ou feuille de style injecté depuis un CDN porte une empreinte d'intégrité.
 *
 * ## Pourquoi ce test existe
 *
 * Mesuré le 09/10/2026 : **cinq** chargements depuis `unpkg.com`, dont **un sans aucun contrôle**
 * — le greffon `leaflet-editable@1.2.0`, chargé sur toutes les pages de gestion de la carte, donc
 * exécuté avec les droits de la session d'un organisateur.
 *
 * Le motif existait pourtant, et il était appliqué **trois lignes plus haut dans le même
 * fichier** : `loadLeaflet` pose `integrity` et `crossOrigin` sur la feuille de style comme sur le
 * script de Leaflet. Ce chargement-là l'avait simplement sauté. C'est la forme habituelle des
 * défauts de ce dépôt — non pas une règle fausse, mais une règle recopiée à laquelle un endroit
 * échappe —, et un correctif ponctuel n'empêche pas le sixième.
 *
 * ## Ce que le test mesure, et pourquoi ainsi
 *
 * Pour chaque fichier, il compte les affectations `*.src = '<url de CDN>'` et
 * `*.href = '<url de CDN>'`, puis exige **au moins autant** d'affectations `integrity` et
 * `crossOrigin`. Un comptage plutôt qu'une analyse de proximité : les lignes voisines se
 * réordonnent, le compte ne se trompe pas de peu.
 *
 * ⚠️ `crossOrigin` EST EXIGÉ AU MÊME TITRE QUE `integrity`, et ce n'est pas du zèle : sans requête
 * CORS, le navigateur n'obtient pas le corps de la réponse en clair pour en vérifier l'empreinte,
 * et il **refuse** le script. Omettre l'un des deux ne laisse pas le chargement « non vérifié » —
 * il le casse.
 *
 * 📍 Les URL d'IMAGES (`iconUrl`, `shadowUrl`, les marqueurs de Leaflet) ne sont pas concernées :
 * elles ne s'exécutent pas, et l'attribut `integrity` ne s'applique pas à une image. Elles sont
 * écrites comme des propriétés d'objet (`iconUrl: '…'`) et non comme des affectations `.src =`,
 * ce qui les écarte naturellement — par leur FORME et non par une liste à tenir à jour.
 */

const CDN =
  /\.(?:src|href)\s*=\s*['"]https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|code\.jquery\.com)/g

function fichiersDeCode(): { chemin: string; contenu: string }[] {
  const racineDepot = path.resolve(__dirname, '../../../../..')
  const racines = [
    path.resolve(__dirname, '../../../app'),
    path.resolve(__dirname, '../../../server'),
    path.resolve(__dirname, '../../../shared'),
    path.resolve(__dirname, '../../../../../layers'),
  ]
  const trouves: { chemin: string; contenu: string }[] = []

  const parcours = (dossier: string) => {
    if (!fs.existsSync(dossier)) return
    for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, entree.name)
      if (entree.isDirectory()) {
        if (entree.name === 'node_modules' || entree.name === '.nuxt') continue
        parcours(complet)
      } else if (/\.(ts|vue)$/.test(entree.name)) {
        trouves.push({
          chemin: path.relative(racineDepot, complet).split(path.sep).join('/'),
          contenu: fs.readFileSync(complet, 'utf8'),
        })
      }
    }
  }
  racines.forEach(parcours)
  return trouves
}

describe('intégrité des scripts chargés depuis un CDN', () => {
  const tous = fichiersDeCode()

  const chargeurs = tous
    .map(({ chemin, contenu }) => ({
      chemin,
      chargements: (contenu.match(CDN) ?? []).length,
      integrity: (contenu.match(/\.integrity\s*=/g) ?? []).length,
      crossOrigin: (contenu.match(/\.crossOrigin\s*=/g) ?? []).length,
    }))
    .filter(({ chargements }) => chargements > 0)

  it('trouve bien les fichiers du dépôt', () => {
    // La garde de la garde : un parcours qui ne rendrait rien laisserait tout le reste vert en ne
    // vérifiant rien.
    expect(tous.length).toBeGreaterThan(500)
  })

  it('trouve bien les deux chargeurs de carte', () => {
    /*
     * Asserté pour que l'ARRIVÉE d'un troisième chargeur se signale. Si ce test tombe parce qu'un
     * fichier neuf charge depuis un CDN, il doit poser les deux attributs — et cette liste grandit.
     */
    expect(chargeurs.map(({ chemin }) => chemin).sort()).toEqual([
      'apps/app1/app/composables/useLeafletEditable.ts',
      'apps/app1/app/composables/useLeafletMap.ts',
    ])
  })

  it('chaque chargement porte une empreinte d’intégrité', () => {
    const manquants = chargeurs
      .filter(({ chargements, integrity }) => integrity < chargements)
      .map(({ chemin, chargements, integrity }) => `${chemin} : ${integrity}/${chargements}`)

    expect(
      manquants,
      "un script tiers sans empreinte s'exécute avec les droits de la session : poser `integrity`"
    ).toEqual([])
  })

  it('chaque chargement porte aussi crossOrigin, sans quoi l’empreinte casse le script', () => {
    const manquants = chargeurs
      .filter(({ chargements, crossOrigin }) => crossOrigin < chargements)
      .map(({ chemin, chargements, crossOrigin }) => `${chemin} : ${crossOrigin}/${chargements}`)

    expect(manquants).toEqual([])
  })

  it('le greffon Leaflet.Editable porte bien l’empreinte du lot', () => {
    /*
     * Le chargement qui a motivé ce test, nommé explicitement : les tests ci-dessus diraient déjà
     * qu'un attribut manque, celui-ci dit LEQUEL et avec QUELLE valeur. L'empreinte a été établie
     * sur le fichier servi par unpkg ET par jsDelivr — identiques octet pour octet, 74 768 octets.
     */
    const fichier = tous.find(({ chemin }) =>
      chemin.endsWith('app/composables/useLeafletEditable.ts')
    )
    expect(fichier).toBeDefined()
    expect(fichier!.contenu).toContain('sha256-Mx8aiCT4w9DBEUBJiX5eq9Ocy+6E3C9wLAik+dgOLY4=')
  })
})
