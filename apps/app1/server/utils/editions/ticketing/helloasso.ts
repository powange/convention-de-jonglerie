import { createLogger } from '#server/utils/logger'

/**
 * Utilitaire pour gérer les interactions avec l'API HelloAsso
 * Utilise l'API REST directement pour une meilleure compatibilité
 */

/*
 * ⚠️ UN JOURNAL À NIVEAUX, PAS DES `console.log` — constat O3.
 *
 * Ce fichier en comptait **vingt-trois**, dont deux déversements complets indentés
 * (`JSON.stringify(…, null, 2)`) qui produisaient des centaines de lignes physiques par appel.
 * `createLogger` existait déjà dans le dépôt et n'était pas employé ici : `LOG_LEVEL` vaut `info`
 * en production, donc tout ce qui est en `debug` en disparaît — sans qu'on ait à choisir entre
 * « tout » et « rien », ce qui était le vrai problème.
 *
 * Ce qui reste en `info` : les deux volumes (combien de commandes à récupérer, combien récupérées).
 * Ce qui passe en `error` : les quatre échecs, qui étaient déjà des `console.error`.
 */
const journal = createLogger('HELLOASSO')

// URL de base de l'API HelloAsso (configurable via variable d'environnement)
const HELLOASSO_API_URL = process.env.HELLOASSO_API_URL || 'https://api.helloasso.com'

interface HelloAssoTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface HelloAssoFormResponse {
  title: string
  formSlug: string
  organizationName: string
  state: string
  formType: string
  tiers?: HelloAssoTier[]
  [key: string]: any
}

interface HelloAssoCustomField {
  id: number
  label: string
  type: string // YesNo, ChoiceList, TextInput, etc.
  isRequired: boolean
  values?: string[] // Valeurs possibles pour les ChoiceList
}

interface HelloAssoTier {
  id: number
  label?: string
  name?: string
  description?: string
  price?: number
  minAmount?: number
  maxAmount?: number
  isActive?: boolean
  customFields?: HelloAssoCustomField[]
  extraOptions?: HelloAssoExtraOption[]
}

interface HelloAssoExtraOption {
  id: number | string
  name?: string
  label?: string
  description?: string
  type: string
  isMandatory?: boolean
  isRequired?: boolean
  values?: string[]
  choices?: string[]
  price?: number // Prix de l'option en centimes
}

interface HelloAssoCredentials {
  clientId: string
  clientSecret: string
}

interface HelloAssoFormIdentifier {
  organizationSlug: string
  formType: string
  formSlug: string
}

/**
 * Récupère un token d'accès OAuth2 depuis l'API HelloAsso
 */
export async function getHelloAssoAccessToken(credentials: HelloAssoCredentials): Promise<string> {
  try {
    journal.debug("récupération du token d'accès", {
      api: HELLOASSO_API_URL,
      clientId: credentials.clientId,
    })

    const response = await fetch(`${HELLOASSO_API_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data: HelloAssoTokenResponse = await response.json()

    if (!data || !data.access_token) {
      throw new Error("Impossible d'obtenir un token d'accès")
    }

    journal.debug("token d'accès obtenu")
    return data.access_token
  } catch (error: any) {
    journal.error("échec de la récupération du token d'accès", error)

    // Utiliser createError si disponible (contexte Nitro), sinon lancer une erreur standard
    if (typeof createError !== 'undefined') {
      throw createError({
        status: 401,
        message: 'Identifiants HelloAsso invalides',
      })
    } else {
      throw new Error('Identifiants HelloAsso invalides')
    }
  }
}

/**
 * Récupère les informations d'un formulaire HelloAsso
 */
export async function getHelloAssoForm(
  accessToken: string,
  formIdentifier: HelloAssoFormIdentifier
): Promise<HelloAssoFormResponse> {
  try {
    journal.debug('récupération du formulaire', formIdentifier)

    // Utiliser directement l'API REST au lieu du SDK
    const url = `${HELLOASSO_API_URL}/v5/organizations/${formIdentifier.organizationSlug}/forms/${formIdentifier.formType}/${formIdentifier.formSlug}/public`
    journal.debug('URL du formulaire', url)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      const statusCode = response.status

      // Gestion des erreurs spécifiques
      if (statusCode === 401) {
        const error =
          typeof createError !== 'undefined'
            ? createError({ status: 401, message: "Token d'accès invalide ou expiré" })
            : new Error("Token d'accès invalide ou expiré")
        throw error
      } else if (statusCode === 404) {
        const error =
          typeof createError !== 'undefined'
            ? createError({
                status: 404,
                message:
                  'Formulaire introuvable. Vérifiez que le formulaire est publié et que les paramètres (slug organisation, type, slug formulaire) sont corrects.',
              })
            : new Error('Formulaire introuvable')
        throw error
      } else if (statusCode === 403) {
        const error =
          typeof createError !== 'undefined'
            ? createError({
                status: 403,
                message:
                  'Accès refusé. Vérifiez que votre client API a le privilège "AccessPublicData".',
              })
            : new Error('Accès refusé')
        throw error
      } else {
        throw new Error(`HTTP ${statusCode}: ${errorText}`)
      }
    }

    const data: HelloAssoFormResponse = await response.json()

    journal.debug('formulaire récupéré', data.title)
    return data
  } catch (error: any) {
    journal.error('échec de la récupération du formulaire', error)
    throw error
  }
}

/**
 * Teste la connexion à l'API HelloAsso avec les credentials fournis
 */
export async function testHelloAssoConnection(
  credentials: HelloAssoCredentials,
  formIdentifier: HelloAssoFormIdentifier
): Promise<{
  success: boolean
  form: {
    name: string
    organizationName: string
    state: string
    formType: string
  }
}> {
  // 1. Obtenir un token
  const accessToken = await getHelloAssoAccessToken(credentials)

  // 2. Récupérer le formulaire
  const formResponse = await getHelloAssoForm(accessToken, formIdentifier)

  // 3. Retourner les informations du formulaire
  return {
    success: true,
    form: {
      name: formResponse.title || formResponse.formSlug,
      organizationName: formResponse.organizationName,
      state: formResponse.state,
      formType: formResponse.formType,
    },
  }
}

/**
 * Récupère les tarifs et options d'un formulaire HelloAsso
 */
export async function getHelloAssoTiersAndOptions(
  credentials: HelloAssoCredentials,
  formIdentifier: HelloAssoFormIdentifier
): Promise<{
  success: boolean
  form: {
    name: string
    organizationName: string
    state: string
  }
  tiers: Array<{
    id: number
    name: string
    description?: string
    price: number
    minAmount?: number
    maxAmount?: number
    isActive: boolean
    extraOptionIds: (number | string)[] // IDs des options associées à ce tarif
  }>
  options: Array<{
    id: number | string
    name: string
    description?: string
    type: string
    isRequired: boolean
    choices: string[]
    price: number | null
  }>
}> {
  // 1. Obtenir un token
  const accessToken = await getHelloAssoAccessToken(credentials)

  // 2. Récupérer le formulaire
  const formResponse = await getHelloAssoForm(accessToken, formIdentifier)

  /*
   * ⚠️ CE DÉVERSEMENT ÉTAIT LE PLUS COÛTEUX DU MODULE — constat O3. `JSON.stringify(…, null, 2)`
   * indente : la réponse complète d'un formulaire HelloAsso produisait des CENTAINES de lignes
   * physiques de journal pour un seul appel. En `debug`, et sans indentation (le journal
   * sérialise lui-même, compact).
   */
  journal.debug('réponse complète du formulaire', formResponse)

  // 3. Extraire les tarifs
  const tiers = formResponse.tiers || []

  // 3.1 Extraire les custom fields du formulaire (champs globaux)
  const formCustomFields = formResponse.customFields || []
  journal.debug('champs personnalisés au niveau du formulaire', {
    nombre: formCustomFields.length,
    champs: formCustomFields,
  })

  // 4. Extraire les options depuis extraOptions de chaque tier
  const allOptionsMap = new Map<number | string, HelloAssoExtraOption>()

  tiers.forEach((tier: HelloAssoTier) => {
    if (tier.extraOptions && Array.isArray(tier.extraOptions)) {
      tier.extraOptions.forEach((option: HelloAssoExtraOption) => {
        const optionId = option.id || option.name || ''
        if (optionId && !allOptionsMap.has(optionId)) {
          allOptionsMap.set(optionId, option)
        }
      })
    }
  })

  const options = Array.from(allOptionsMap.values())

  journal.debug('tarifs et options extraits', { tarifs: tiers.length, options: options.length })

  // 5. Formater les données pour le frontend
  const formattedTiers = tiers.map((tier: HelloAssoTier) => {
    // Les custom fields peuvent être soit au niveau du tier, soit hérités du formulaire
    const tierCustomFields = tier.customFields || formCustomFields
    // Une ligne PAR TARIF : en `debug`, donc hors production.
    journal.debug('champs personnalisés d’un tarif', {
      tarif: tier.label || tier.name,
      nombre: tierCustomFields.length,
    })

    // Extraire les IDs des options associées à ce tarif
    const extraOptionIds = (tier.extraOptions || [])
      .map((opt: HelloAssoExtraOption) => opt.id || opt.name || '')
      .filter(Boolean)

    return {
      id: tier.id,
      name: tier.label || tier.name || '',
      description: tier.description,
      // HelloAsso utilise minAmount comme prix de base, price n'est pas toujours présent
      price: tier.price ?? tier.minAmount ?? 0,
      minAmount: tier.minAmount,
      maxAmount: tier.maxAmount,
      isActive: tier.isActive ?? true, // Actif par défaut si non spécifié
      customFields: tierCustomFields, // Inclure les custom fields (du tier ou du formulaire)
      extraOptionIds, // IDs des options associées à ce tarif
    }
  })

  const formattedOptions = options.map((option: HelloAssoExtraOption) => ({
    id: option.id ?? option.name ?? '',
    name: option.name ?? option.label ?? '',
    description: option.description,
    type: option.type || 'TextInput',
    isRequired: option.isMandatory ?? option.isRequired ?? false,
    choices: option.values ?? option.choices ?? [],
    price: option.price ?? null, // Prix en centimes
  }))

  return {
    success: true,
    form: {
      name: formResponse.title || formResponse.formSlug,
      organizationName: formResponse.organizationName,
      state: formResponse.state,
    },
    tiers: formattedTiers,
    options: formattedOptions,
  }
}

/**
 * Récupère une page de commandes d'un formulaire HelloAsso
 */
async function fetchOrdersPageFromHelloAsso(
  accessToken: string,
  formIdentifier: HelloAssoFormIdentifier,
  pageIndex: number,
  pageSize: number,
  withDetails: boolean
): Promise<{
  data: Array<{
    id: number
    payer: {
      firstName: string
      lastName: string
      email: string
    }
    items: Array<{
      id: number
      amount: number
      name: string
      priceCategory: string
      qrCode?: string
      type: string
      state: string
      user?: {
        firstName: string
        lastName: string
        email: string
      }
      customFields?: Array<{
        name: string
        answer: string
      }>
      options?: Array<{
        name: string
        amount: number
        priceCategory: string
        isRequired: boolean
        optionId: number
        customFields?: Array<{
          name: string
          answer: string
        }>
      }>
    }>
  }>
  pagination: {
    pageIndex: number
    pageSize: number
    totalPages: number
    totalCount: number
  }
}> {
  try {
    // Construire l'URL avec les paramètres de requête
    const params = new URLSearchParams({
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
      withDetails: String(withDetails),
      withCount: 'true',
    })

    const url = `${HELLOASSO_API_URL}/v5/organizations/${formIdentifier.organizationSlug}/forms/${formIdentifier.formType}/${formIdentifier.formSlug}/orders?${params}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      const statusCode = response.status

      // Gestion des erreurs spécifiques
      if (statusCode === 401) {
        const error =
          typeof createError !== 'undefined'
            ? createError({ status: 401, message: "Token d'accès invalide ou expiré" })
            : new Error("Token d'accès invalide ou expiré")
        throw error
      } else if (statusCode === 404) {
        const error =
          typeof createError !== 'undefined'
            ? createError({ status: 404, message: 'Formulaire introuvable' })
            : new Error('Formulaire introuvable')
        throw error
      } else if (statusCode === 403) {
        const error =
          typeof createError !== 'undefined'
            ? createError({
                status: 403,
                message: 'Accès refusé. Vérifiez les permissions de votre client API',
              })
            : new Error('Accès refusé. Vérifiez les permissions de votre client API')
        throw error
      } else {
        throw new Error(`HTTP ${statusCode}: ${errorText}`)
      }
    }

    return await response.json()
  } catch (error: any) {
    journal.error('échec de la récupération des commandes', error)
    throw error
  }
}

/**
 * Récupère toutes les commandes d'un formulaire HelloAsso (toutes les pages)
 */
export async function fetchOrdersFromHelloAsso(
  credentials: HelloAssoCredentials,
  formIdentifier: HelloAssoFormIdentifier,
  options?: {
    withDetails?: boolean
    pageSize?: number
  }
): Promise<{
  data: Array<{
    id: number
    date: string // Date de la commande au format ISO
    payer: {
      firstName: string
      lastName: string
      email: string
    }
    items: Array<{
      id: number
      amount: number
      name: string
      priceCategory: string
      qrCode?: string
      type: string
      state: string
      tierId?: number // ID du tarif HelloAsso
      user?: {
        firstName: string
        lastName: string
        email: string
      }
      customFields?: Array<{
        name: string
        answer: string
      }>
      options?: Array<{
        name: string
        amount: number
        priceCategory: string
        isRequired: boolean
        optionId: number
        customFields?: Array<{
          name: string
          answer: string
        }>
      }>
    }>
  }>
  pagination: {
    pageIndex: number
    pageSize: number
    totalPages: number
    totalCount: number
  }
}> {
  try {
    journal.debug('récupération des commandes', { ...formIdentifier, options })

    // 1. Obtenir un token d'accès
    const accessToken = await getHelloAssoAccessToken(credentials)

    const pageSize = options?.pageSize ?? 100
    const withDetails = options?.withDetails ?? true
    let currentPage = 1
    const allOrders: Array<any> = []

    // 2. Récupérer la première page pour connaître le nombre total de pages
    journal.debug('récupération de la page 1')
    const firstPageResult = await fetchOrdersPageFromHelloAsso(
      accessToken,
      formIdentifier,
      currentPage,
      pageSize,
      withDetails
    )

    allOrders.push(...firstPageResult.data)

    const totalPages = firstPageResult.pagination.totalPages
    const totalCount = firstPageResult.pagination.totalCount

    journal.info('commandes à récupérer', { commandes: totalCount, pages: totalPages })

    // 3. Récupérer les pages suivantes si nécessaire
    if (totalPages > 1) {
      for (currentPage = 2; currentPage <= totalPages; currentPage++) {
        journal.debug('récupération d’une page', { page: currentPage, total: totalPages })
        const pageResult = await fetchOrdersPageFromHelloAsso(
          accessToken,
          formIdentifier,
          currentPage,
          pageSize,
          withDetails
        )
        allOrders.push(...pageResult.data)
      }
    }

    journal.info('commandes récupérées', { nombre: allOrders.length })

    return {
      data: allOrders,
      pagination: {
        pageIndex: 1,
        pageSize: allOrders.length,
        totalPages: 1,
        totalCount: allOrders.length,
      },
    }
  } catch (error: any) {
    journal.error('échec de fetchOrdersFromHelloAsso', error)
    throw error
  }
}

/**
 * Type pour exporter les interfaces
 */
export type {
  HelloAssoCredentials,
  HelloAssoFormIdentifier,
  HelloAssoTokenResponse,
  HelloAssoFormResponse,
  HelloAssoTier,
  HelloAssoExtraOption,
}
