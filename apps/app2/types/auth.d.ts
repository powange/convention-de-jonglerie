// Typage de la session nuxt-auth-utils pour app2.
declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    name: string | null
  }

  interface UserSession {
    user?: User
    loggedInAt?: string
  }

  // Pas de données de session « secure » spécifiques pour le moment.
  interface SecureSessionData {}
}

export {}
