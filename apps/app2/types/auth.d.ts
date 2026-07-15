// Typage de la session nuxt-auth-utils pour app2.
// Forme alignée sur ce qu'écrit le layer d'auth (layers/auth) : login classique et OAuth.
declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    pseudo: string
    nom?: string | null
    prenom?: string | null
    phone?: string | null
    profilePicture?: string | null
    isGlobalAdmin?: boolean
    isVolunteer?: boolean
    isArtist?: boolean
    isOrganizer?: boolean
    isEmailVerified?: boolean
    createdAt?: string | Date
    updatedAt?: string | Date
  }

  interface UserSession {
    user?: User
    loggedInAt?: string
  }

  // Pas de données de session « secure » spécifiques pour le moment.
  interface SecureSessionData {}
}

export {}
