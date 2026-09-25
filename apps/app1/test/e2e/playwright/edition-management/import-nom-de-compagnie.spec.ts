import { expect, test } from '@nuxt/test-utils/playwright'

import {
  apiDelete,
  apiPost,
  apiPut,
  buildShowApplicationBody,
  createShow,
  enableArtistProfile,
  createShowCall,
  getShow,
  importPerformerFromApplication,
  linkApplicationToShow,
  loadState,
  submitShowApplicationViaApi,
  updateEdition,
  updateShowCall,
  updateShowCallApplicationStatus,
} from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Le nom d'artiste ou de compagnie d'une candidature doit survivre à l'import.
 *
 * Il ne survivait pas. `artistName` est obligatoire pour le candidat et affiché partout dans
 * l'appel à spectacle — liste, fiche, sondage, messagerie, notifications — puis disparaissait au
 * moment précis où la candidature devenait un spectacle ou un numéro. `Show.companyName` existait
 * pourtant, et son commentaire de schéma désignait exactement cet usage ; rien ne l'écrivait en
 * dehors du formulaire manuel. `ShowAct`, lui, n'avait aucun champ pour le recevoir.
 *
 * ⚠️ **Ce spec vit dans le lot `gestion-1b`, et non n'importe lequel.** Candidater met à jour les
 * informations personnelles du compte — le vrai formulaire le fait, et `buildShowApplicationBody`
 * le dit. Le compte étant partagé, ce spec laisse donc « E2E-Prenom » derrière lui. Or la
 * candidature BÉNÉVOLE ne renseigne le profil que s'il est vide : dans le même lot que
 * `volunteers.spec.ts`, celui-ci cherchait ensuite « E2E-Prénom » — un accent de différence — et ne
 * le trouvait plus. Il est donc rangé avec les autres specs d'appel à spectacle, qui salissent le
 * profil de la même manière et cohabitent déjà sans heurt.
 */
test.describe.serial('Import d’une candidature — nom de compagnie', () => {
  const ts = Date.now()
  const NOM_DE_SCENE = `Cie des Trois Massues ${ts}`
  const NOM_DEJA_SAISI = 'Nom posé par l’organisation'

  /**
   * Une édition dédiée, et non celle du harnais.
   *
   * Ce test crée trois appels à spectacles, trois candidatures, deux spectacles et importe des
   * artistes — lesquels créent à leur tour des comptes et des lignes `EditionArtist`. Sur l'édition
   * partagée, `volunteers.spec.ts`, qui vit dans le même lot Playwright, n'y retrouvait plus son
   * bouton « postuler » : reproductible en les enchaînant, vert en les jouant séparément.
   *
   * Le mécanisme exact n'a pas été isolé. L'édition dédiée le rend sans objet, et c'est déjà le
   * motif qu'emploient les autres specs qui salissent beaucoup.
   */
  let editionId = ''
  let standardId = 0
  let cabaretId = 0

  /**
   * Un appel à spectacles PAR candidature.
   *
   * Le serveur n'accepte qu'une candidature par appel et par compte — « Vous avez déjà soumis une
   * candidature pour cet appel à spectacles ». Or ce test en demande trois : deux vers le même
   * spectacle standard, pour éprouver le non-écrasement, et une vers le cabaret.
   */
  const candidater = async (page: import('@playwright/test').Page, titre: string) => {
    const appel = await createShowCall(page, editionId, {
      name: `Appel compagnie ${ts} — ${titre}`,
      description: 'Appel E2E pour le nom de compagnie à l’import',
    })
    const showCallId = String(appel.id)

    // Public, interne, échéance à venir : sans cela le POST d'une candidature rend 403.
    const echeance = new Date()
    echeance.setDate(echeance.getDate() + 30)
    await updateShowCall(page, editionId, showCallId, {
      name: `Appel compagnie ${ts} — ${titre}`,
      visibility: 'PUBLIC',
      mode: 'INTERNAL',
      deadline: echeance.toISOString(),
    })

    const candidature = await submitShowApplicationViaApi(
      page,
      editionId,
      showCallId,
      buildShowApplicationBody({
        artistName: NOM_DE_SCENE,
        showTitle: titre,
        additionalPerformersCount: 1,
        additionalPerformers: [
          {
            lastName: 'CompNom',
            firstName: 'CompPrenom',
            email: `e2e-compagnie-${ts}-${titre.length}@example.com`,
            phone: '+33611112222',
          },
        ],
      })
    )
    await updateShowCallApplicationStatus(page, editionId, showCallId, String(candidature.id), {
      status: 'ACCEPTED',
    })
    return { showCallId, applicationId: String(candidature.id) }
  }

  test('préparer une édition dédiée et les deux spectacles', async ({ page }) => {
    const { conventionId } = loadState()
    const debut = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const fin = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const edition = await apiPost(page, `${BASE}/api/editions`, {
      data: {
        conventionId: Number(conventionId),
        startDate: debut.toISOString(),
        endDate: fin.toISOString(),
        addressLine1: '1 rue des Massues',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      },
    })
    expect(edition.ok(), `création d'édition : ${await edition.text()}`).toBe(true)
    const corps = await edition.json()
    editionId = String(corps.data?.id ?? corps.id)

    await updateEdition(page, editionId, { artistsEnabled: true })
    // Sans la catégorie « Artiste » sur le compte, le POST d'une candidature rend 403.
    await enableArtistProfile(page)

    const standard = await createShow(page, editionId, {
      title: `Standard compagnie ${ts}`,
      startDateTime: new Date().toISOString(),
      duration: 45,
    })
    standardId = Number(standard.id)

    const cabaret = await createShow(page, editionId, {
      title: `Cabaret compagnie ${ts}`,
      type: 'CABARET',
      startDateTime: new Date().toISOString(),
      duration: 90,
    })
    cabaretId = Number(cabaret.id)

    // Le point de départ, mesuré et non supposé : les deux arrivent sans compagnie.
    expect(standard.companyName ?? null).toBeNull()
  })

  test('spectacle STANDARD : le nom de scène devient la compagnie du spectacle', async ({
    page,
  }) => {
    const { showCallId, applicationId } = await candidater(page, `Vers le standard ${ts}`)
    await linkApplicationToShow(page, editionId, showCallId, applicationId, standardId)

    const resultat = await importPerformerFromApplication(
      page,
      editionId,
      showCallId,
      applicationId,
      { performerIndex: 0 }
    )
    expect(resultat.showCompanyNameSet).toBe(true)

    const spectacle = await getShow(page, editionId, standardId)
    expect(spectacle.companyName).toBe(NOM_DE_SCENE)
  })

  test('spectacle STANDARD : une compagnie déjà saisie n’est pas écrasée', async ({ page }) => {
    // L'organisation nomme la compagnie à la main.
    const reponse = await apiPut(page, `${BASE}/api/editions/${editionId}/shows/${standardId}`, {
      data: { companyName: NOM_DEJA_SAISI },
    })
    expect(reponse.ok(), await reponse.text()).toBe(true)

    // Une seconde candidature rejoint le même spectacle.
    const { showCallId, applicationId } = await candidater(page, `Vers le standard bis ${ts}`)
    await linkApplicationToShow(page, editionId, showCallId, applicationId, standardId)
    const resultat = await importPerformerFromApplication(
      page,
      editionId,
      showCallId,
      applicationId,
      { performerIndex: 0 }
    )

    // C'est la règle explicite de cet import : il complète ce qui manque, il n'écrase jamais une
    // saisie de l'organisation.
    expect(resultat.showCompanyNameSet).toBeFalsy()
    const spectacle = await getShow(page, editionId, standardId)
    expect(spectacle.companyName).toBe(NOM_DEJA_SAISI)
  })

  test('spectacle CABARET : le nom de scène devient la compagnie du numéro', async ({ page }) => {
    const titre = `Vers le cabaret ${ts}`
    const { showCallId, applicationId } = await candidater(page, titre)
    await linkApplicationToShow(page, editionId, showCallId, applicationId, cabaretId)

    const resultat = await importPerformerFromApplication(
      page,
      editionId,
      showCallId,
      applicationId,
      { performerIndex: 0 }
    )
    expect(resultat.actCreated).toBe(true)

    // Le numéro porte le titre de la candidature, et désormais sa compagnie.
    const cabaret = await getShow(page, editionId, cabaretId)
    const numero = (cabaret.acts ?? []).find((a: { title: string }) => a.title === titre)
    expect(numero, 'le numéro créé depuis la candidature').toBeTruthy()
    expect(numero.companyName).toBe(NOM_DE_SCENE)
  })

  test('la compagnie du numéro survit à un enregistrement du cabaret', async ({ page }) => {
    const cabaret = await getShow(page, editionId, cabaretId)

    /*
     * Le vrai risque de ce lot, et la raison de ce test.
     *
     * La recomposition d'un cabaret écrit `companyName` à chaque enregistrement. Un client qui ne
     * renverrait pas le champ l'y poserait donc à `null` — et effacerait, au premier
     * enregistrement, le nom que l'import venait de reprendre. On rejoue ici ce que la page envoie.
     */
    const reponse = await apiPut(page, `${BASE}/api/editions/${editionId}/shows/${cabaretId}`, {
      data: {
        acts: (cabaret.acts ?? []).map(
          (a: { id: number; title: string; companyName: string | null }) => ({
            id: a.id,
            title: a.title,
            companyName: a.companyName,
            artistIds: [],
          })
        ),
      },
    })
    expect(reponse.ok(), await reponse.text()).toBe(true)

    const apres = await getShow(page, editionId, cabaretId)
    const numeros = (apres.acts ?? []) as { companyName: string | null }[]
    expect(numeros.some((a) => a.companyName === NOM_DE_SCENE)).toBe(true)
  })

  test('nettoyage : supprimer l’édition dédiée', async ({ page }) => {
    // Une seule suppression suffit : spectacles, appels, candidatures et artistes importés
    // dépendent de l'édition et partent avec elle.
    if (editionId) {
      const suppression = await apiDelete(page, `${BASE}/api/editions/${editionId}`)
      expect(suppression.ok(), await suppression.text()).toBe(true)
    }
  })
})
