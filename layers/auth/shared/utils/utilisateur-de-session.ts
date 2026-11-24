/**
 * La copie du compte que porte une session — constat B9.
 *
 * ## Le défaut : huit ouvertures, cinq formes différentes
 *
 * Tout ce qui connecte quelqu'un recopiait un objet `user` à la main, et personne ne les avait
 * jamais comparés. Relevé champ par champ sur les huit points d'entrée :
 *
 * | ouverture de session | téléphone | catégories | emailHash | profilePicture |
 * | --- | --- | --- | --- | --- |
 * | formulaire (`login`) | ✅ | ✅ | ❌ | ❌ |
 * | Google, Facebook | ❌ | ❌ | ❌ | ✅ |
 * | vérification d'adresse, invitation, mot de passe | ✅ | ✅ | ❌ | ❌ |
 * | usurpation d'identité | ✅ | ✅ | ✅ | ❌ |
 * | **fin** d'usurpation | ✅ | ❌ | ❌ | ❌ |
 *
 * Le middleware pose cette copie dans `event.context.user`, que `requireAuth` rend à **tous** les
 * points d'API. Une session ouverte par Google plaçait donc un compte sans `isOrganizer` et sans
 * téléphone là où une session ouverte par le formulaire en plaçait un complet.
 *
 * ## ⚠️ CE QUI N'EST PAS AFFIRMÉ : qu'un écran en souffrait
 *
 * Mesuré, et c'est l'inverse de ce qu'on pouvait craindre : **rien ne lit ces champs dans la
 * session**. `AuthenticatedUser` n'en déclare que quatre (`id`, `email`, `pseudo`,
 * `isGlobalAdmin`), le client recharge tout depuis la base par `/api/session/me`, et les deux
 * composants qui lisent `useUserSession()` n'y prennent que `nom` et `prenom` — présents partout.
 *
 * Ce qui se corrige ici est donc un **piège**, pas un symptôme : le jour où un point d'API lira
 * `user.isOrganizer`, il recevra `undefined` pour trois sessions sur huit, sans erreur, sans
 * journal, et avec un comportement qui dépend de la façon dont la personne s'est connectée.
 *
 * ## Pourquoi CES champs, et pas l'union de tout ce qui existait
 *
 * La liste est exactement celle dont la **péremption est déjà gérée** : `pseudo`, `nom`, `prenom`,
 * `phone` et les trois catégories sont rafraîchis par le profil (`rafraichirUtilisateurDeSession`),
 * `email` par la confirmation d'adresse, et le reste ne change pas de la vie d'une session.
 *
 * Deux champs sont donc **retirés** des sessions qui les portaient, à dessein :
 *
 * - `profilePicture` (Google et Facebook) : rien ne le lit dans la session, et l'y garder
 *   obligerait à le rafraîchir à chaque changement de photo — soit exactement le défaut B5, créé
 *   de toutes pièces pour un champ que personne ne consulte.
 * - `emailHash` (usurpation d'identité) : même raison, et la démonstration est faite —
 *   `confirm-email` rafraîchit `email` **sans** `emailHash`, donc une session qui le porterait
 *   afficherait l'avatar de l'ANCIENNE adresse après un changement.
 *
 * 📍 Et cela corrige une affirmation fausse écrite dans `profile/update.put.ts` :
 * « la session ne l'a jamais portée (vérifié à l'ouverture, côté `login`) ». Elle était juste de
 * `login`, et fausse des deux fournisseurs OAuth — vérifier **un** point d'entrée ne dit rien des
 * sept autres. C'est le même angle mort que ce fichier referme.
 */

/** Les champs lus sur le compte pour composer la session. */
export interface CompteDeSession {
  id: number
  email: string
  pseudo: string
  nom: string | null
  prenom: string | null
  phone: string | null
  isGlobalAdmin: boolean
  isVolunteer: boolean
  isArtist: boolean
  isOrganizer: boolean
  createdAt: Date
  updatedAt: Date
  isEmailVerified: boolean
}

export type UtilisateurDeSession = CompteDeSession

/**
 * La copie du compte à écrire dans la session, identique pour les huit ouvertures.
 *
 * ⚠️ Les champs sont recopiés UN À UN, et non par un `...compte` : la session est un cookie
 * scellé envoyé au navigateur à chaque requête. Un `spread` y déverserait tout ce que l'appelant
 * a sous la main — le hachage du mot de passe des points d'entrée qui lisent le compte entier,
 * les jetons de réinitialisation, l'adresse en attente de confirmation.
 */
export function utilisateurDeSession(compte: CompteDeSession): UtilisateurDeSession {
  return {
    id: compte.id,
    email: compte.email,
    pseudo: compte.pseudo,
    nom: compte.nom,
    prenom: compte.prenom,
    phone: compte.phone,
    isGlobalAdmin: compte.isGlobalAdmin,
    isVolunteer: compte.isVolunteer,
    isArtist: compte.isArtist,
    isOrganizer: compte.isOrganizer,
    createdAt: compte.createdAt,
    updatedAt: compte.updatedAt,
    isEmailVerified: compte.isEmailVerified,
  }
}
