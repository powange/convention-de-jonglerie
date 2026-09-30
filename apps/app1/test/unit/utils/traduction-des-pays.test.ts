import countries from 'i18n-iso-countries'
import { beforeAll, describe, expect, it } from 'vitest'

import { getCountryCode, translateCountry, translateToFrench } from '../../../app/utils/countries'

/**
 * La résolution d'un nom de pays, et pourquoi les treize langues sont nécessaires.
 *
 * ⚠️ LE FAIT QUI COMMANDE TOUT : la base stocke le pays d'une édition en TEXTE LIBRE, dans la
 * langue de qui l'a saisi. Relevé sur les données de développement, on y trouve côte à côte
 * « Suisse » et « Switzerland », « Italie » et « Italia », « Royaume-Uni » et « United Kingdom ».
 *
 * `getCountryCode` et `translateCountry` parcourent donc les treize langues jusqu'à reconnaître le
 * nom, puis rendent le code ISO — c'est ce qui permet d'afficher le bon drapeau et le bon libellé
 * quelle que soit la langue de saisie.
 *
 * ⚠️ CE QUE CES TESTS INTERDISENT. Une optimisation évidente consiste à n'enregistrer que la langue
 * du lecteur : les 116 Ko de `i18n-iso-countries` deviennent 9 Ko. C'est ce qu'un constat du
 * rapport proposait. Ce serait FAUX ici : une convention saisie en allemand perdrait son drapeau
 * et resterait affichée en allemand pour un lecteur français, SANS AUCUNE ERREUR. Les cas
 * ci-dessous tomberaient — c'est leur raison d'être.
 */

/**
 * Le greffon qui enregistre les langues ne tourne pas dans un test unitaire : on le refait à la
 * main, avec les mêmes langues, sans quoi tout ce fichier mesurerait un registre vide.
 */
beforeAll(async () => {
  const langues = ['cs', 'da', 'de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sv', 'uk']
  for (const langue of langues) {
    const module = await import(`i18n-iso-countries/langs/${langue}.json`)
    countries.registerLocale((module.default ?? module) as never)
  }
})

describe('getCountryCode', () => {
  it('reconnaît un nom FRANÇAIS', () => {
    expect(getCountryCode('Suisse')).toBe('ch')
  })

  it('reconnaît le MÊME pays écrit dans une AUTRE langue', () => {
    /*
     * 🔬 LE TEST QUI PORTE TOUT. Ces trois graphies coexistent réellement en base. Si seule la
     * langue du lecteur était enregistrée, deux d'entre elles sur trois rendraient « xx » — donc
     * pas de drapeau, et un nom non traduit.
     */
    expect(getCountryCode('Switzerland')).toBe('ch')
    expect(getCountryCode('Schweiz')).toBe('ch')
    expect(getCountryCode('Svizzera')).toBe('ch')
  })

  it('reconnaît « Italia » aussi bien que « Italie »', () => {
    // Les deux sont dans la base de développement, sur des éditions différentes.
    expect(getCountryCode('Italie')).toBe('it')
    expect(getCountryCode('Italia')).toBe('it')
  })

  it('rend `xx` pour ce qu’il ne reconnaît pas, sans lever', () => {
    // Un pays mal orthographié ne doit pas casser la carte : il perd son drapeau, c'est tout.
    expect(getCountryCode('Pays imaginaire')).toBe('xx')
    expect(getCountryCode('')).toBe('xx')
  })

  it('passe par les alias pour les noms courants hors ISO', () => {
    // « USA » et « UK » ne sont pas des libellés ISO : sans la table d'alias, ils rendraient `xx`.
    expect(getCountryCode('USA')).toBe('us')
    expect(getCountryCode('UK')).toBe('gb')
    expect(getCountryCode('États-Unis')).toBe('us')
  })
})

describe('translateCountry', () => {
  it('traduit un nom saisi dans une autre langue', () => {
    /*
     * 🔬 Le pendant visible du test précédent : c'est ce que lit l'utilisateur. Sans la recherche
     * croisée, « Switzerland » resterait « Switzerland » sur un site en français.
     */
    expect(translateCountry('Switzerland', 'fr')).toBe('Suisse')
    expect(translateCountry('Allemagne', 'en')).toBe('Germany')
    expect(translateCountry('Italia', 'fr')).toBe('Italie')
  })

  it('rend le nom D’ORIGINE quand il ne reconnaît rien', () => {
    // Mieux vaut afficher ce que l'organisateur a écrit qu'une chaîne vide.
    expect(translateCountry('Pays imaginaire', 'fr')).toBe('Pays imaginaire')
  })

  it('traduit vers le français par le raccourci dédié', () => {
    expect(translateToFrench('Germany')).toBe('Allemagne')
  })
})
