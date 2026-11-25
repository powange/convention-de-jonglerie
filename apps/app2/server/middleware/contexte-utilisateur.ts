/**
 * Place l'utilisateur de la session dans `event.context.user`.
 *
 * C'est le contrat de `requireAuth` / `optionalAuth` (layers/core) : le layer bénévoles les appelle
 * de façon synchrone et lit ce contexte, comme dans app1 où son middleware d'authentification le
 * remplit. Sans ce middleware, toute route du layer répondrait 401.
 *
 * Plus simple que celui d'app1 : Flowvent n'a ni génération de session à comparer, ni
 * usurpation d'identité. La session est un cookie scellé (nuxt-auth-utils) : la lire ne coûte
 * aucune requête en base.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  event.context.user = session.user ?? null
})
