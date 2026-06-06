/**
 * Endpoint de DEBUG (admin uniquement, désactivé en production).
 *
 * Génère volontairement une erreur serveur pour tester :
 *  - l'enregistrement de la vraie erreur dans /admin/error-logs
 *  - l'alerte push envoyée aux admins globaux
 *
 * Usage : GET /api/admin/debug/throw-error?kind=generic
 *   kind=generic (défaut) : `throw new Error(...)` -> 500 via wrapApiHandler
 *                           (teste la récupération du vrai message via `cause`)
 *   kind=type             : accès à une propriété de `undefined` -> TypeError
 *   kind=prisma           : requête Prisma invalide -> erreur base de données
 *   kind=createError      : `createError` 500 direct (message générique uniquement)
 *
 * ⚠️ À SUPPRIMER après les tests.
 */
export default wrapApiHandler(
  async (event) => {
    // Indisponible en production
    if (!import.meta.dev) {
      throw createError({ status: 404, message: 'Not found' })
    }

    // Réservé aux admins globaux (vérification en BDD)
    await requireGlobalAdminWithDbCheck(event)

    const kind = (getQuery(event).kind as string) || 'generic'

    switch (kind) {
      case 'type': {
        // TypeError: Cannot read properties of undefined (reading 'bar')
        const obj = undefined as any
        return obj.foo.bar
      }

      case 'prisma': {
        // Erreur Prisma (champ inexistant) -> classée DatabaseError
        return await prisma.user.findMany({ where: { champ_inexistant: true } as any })
      }

      case 'createError': {
        // 500 « propre » via createError (pas d'erreur d'origine à récupérer)
        throw createError({ status: 500, message: 'Erreur 500 de test (createError direct)' })
      }

      case 'generic':
      default: {
        // Vraie erreur applicative : sera ré-emballée en 500 par wrapApiHandler,
        // le vrai message étant conservé via `cause`.
        throw new Error('💥 Erreur 500 de test (générée volontairement pour debug)')
      }
    }
  },
  { operationName: 'DebugThrowError' }
)
