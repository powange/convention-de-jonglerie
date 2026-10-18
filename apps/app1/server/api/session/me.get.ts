import { createError } from 'h3'

import type { SessionMeResponse } from '#server/types/api-responses'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getImpersonationCookie } from '#server/utils/impersonation-helpers'

export default wrapApiHandler<SessionMeResponse>(
  async (event) => {
    /*
     * ⚠️ `requireAuth` ET NON `requireUserSession`, pour trois raisons.
     *
     * 1. `/api/session/me` n'est PAS une route publique : le middleware d'authentification a donc
     *    déjà descellé la session, vérifié que le compte existe, et posé l'utilisateur sur
     *    `event.context`. Redemander la session ici la descelle une SECONDE fois, à chaque
     *    chargement de page — et le magasin client relève déjà que chaque appel coûte deux
     *    lectures en base.
     * 2. Le cast disparaît. `requireUserSession` rend un `SessionUser` dont l'`id` n'est pas
     *    garanti par le type, d'où le `(session.user as any).id` qui était écrit ici.
     * 3. Le gestionnaire devient TESTABLE. `requireUserSession` vient de `#imports`, que le
     *    bouchon global de `test/setup.ts` n'atteint pas pour du code serveur : AUCUN test de ce
     *    dépôt n'exerce un handler qui l'emploie, et c'est pourquoi celui-ci n'en avait aucun.
     *    `requireAuth` lit le contexte, ce que des dizaines de tests remplacent en deux lignes.
     */
    const utilisateur = requireAuth(event)

    // Recharger les champs éventuellement manquants (telephone, profilePicture...)
    const full = await prisma.user.findUnique({
      where: { id: utilisateur.id },
      select: {
        id: true,
        email: true,
        emailHash: true,
        /*
         * L'adresse DEMANDÉE et pas encore confirmée — constat B2. Sans ce champ, l'écran du profil
         * ne pourrait pas rappeler qu'un changement est en cours : on taperait une nouvelle adresse,
         * on verrait l'ancienne revenir au rechargement, et rien n'expliquerait pourquoi.
         */
        pendingEmail: true,
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        pronouns: true,
        profilePicture: true,
        isGlobalAdmin: true,
        isVolunteer: true,
        isArtist: true,
        isOrganizer: true,
        /*
         * La langue du profil, pour que le client l'applique à l'hydratation. Sans ce champ dans la
         * réponse, l'interface reste dans la langue du NAVIGATEUR alors que la personne a
         * explicitement choisi la sienne dans son profil — et le réglage paraît sans effet.
         */
        preferredLanguage: true,
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    /*
     * ⚠️ PAS de repli sur `session.user`, et ce n'est pas un durcissement gratuit.
     *
     * Le code écrivait `full || session.user`. Or ce repli est INATTEIGNABLE : le middleware
     * d'authentification (`server/middleware/auth.ts`) refuse déjà toute session dont le compte
     * n'existe plus, avec ce message exact, AVANT que ce gestionnaire ne s'exécute —
     * `sessionRecevable()` rend `false` quand `versionDeSessionDuCompte()` est nulle, et les
     * quatre suppressions de compte oublient explicitement son cache de trente secondes.
     *
     * Il reste la course : une suppression survenant entre le contrôle du middleware et ce
     * `findUnique`. Mieux vaut alors forcer la reconnexion que renvoyer un profil amputé —
     * `session.user` n'est qu'un `SessionUser`, dont presque tous les champs sont optionnels, et
     * l'écran du profil afficherait des trous sans rien expliquer.
     *
     * 📍 C'est aussi ce qui rendait le type de cette réponse impossible à honorer : `SessionMeUser`
     * exige des champs que `session.user` ne garantit pas. Le contrat et le code disent désormais
     * la même chose.
     *
     * ⚠️ Et le refus vient AVANT la lecture du cookie d'emprunt d'identité. Je l'avais d'abord
     * placé juste avant le `return`, donc après ce desceller : un témoin de test l'a montré en
     * vérifiant que RIEN n'est lu quand le compte est absent. On refuse sans travailler.
     */
    if (!full) {
      throw createError({ status: 401, message: 'Session invalide, veuillez vous reconnecter' })
    }

    // Récupérer les informations d'impersonation depuis la session scellée
    const impersonation = await getImpersonationCookie(event)

    return {
      user: full,
      impersonation: impersonation || null,
    }
  },
  { operationName: 'GetCurrentUserSession' }
)
