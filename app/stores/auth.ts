import { defineStore } from 'pinia';
import type { User } from '~/types';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: null as string | null,
    tokenExpiry: null as number | null,
    rememberMe: false,
    adminMode: false,
  }),
  getters: {
    isAuthenticated: (state) => {
      if (!state.token || !state.tokenExpiry) return false;
      // Vérifier si le token n'est pas expiré
      return Date.now() < state.tokenExpiry;
    },
    isGlobalAdmin: (state) => {
      return state.user?.isGlobalAdmin || false;
    },
    isAdminModeActive: (state) => {
      return state.user?.isGlobalAdmin && state.adminMode;
    },
  },
  actions: {
    async register(email: string, password: string, pseudo: string, nom: string, prenom: string) {
      const response = await $fetch('/api/auth/register', {
        method: 'POST',
        body: { email, password, pseudo, nom, prenom },
      });
      return response;
    },
    async login(identifier: string, password: string, rememberMe: boolean = false) {
      const response = await $fetch<{ token: string; user: User }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: { identifier, password },
        }
      );

      this.token = response.token;
      this.user = response.user;
      this.rememberMe = rememberMe;

      // Calculer l'expiration (aligné avec le JWT côté serveur: 7 jours)
      this.tokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

      // Store in localStorage ou sessionStorage selon "Se souvenir de moi"
      if (import.meta.client) {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('authToken', response.token);
        storage.setItem('authUser', JSON.stringify(response.user));
        storage.setItem('tokenExpiry', String(this.tokenExpiry));
        storage.setItem('rememberMe', String(rememberMe));

        // Également stocker le token dans un cookie pour les requêtes serveur
        const cookieExpiry = rememberMe
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : undefined; // 30 jours si "se souvenir"
        const cookieToken = useCookie('auth-token', {
          expires: cookieExpiry,
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        });
        cookieToken.value = response.token;
      }

      return response;
    },
    logout() {
      this.user = null;
      this.token = null;
      this.tokenExpiry = null;
      this.rememberMe = false;
      this.adminMode = false;
      
      if (import.meta.client) {
        // Nettoyer les deux storages
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('adminMode');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('authUser');
        sessionStorage.removeItem('tokenExpiry');
        sessionStorage.removeItem('rememberMe');
        sessionStorage.removeItem('adminMode');
        
        // Supprimer le cookie d'authentification
        const cookieToken = useCookie('auth-token');
        cookieToken.value = null;
      }
    },
    initializeAuth() {
      if (import.meta.client) {
        // Vérifier d'abord localStorage, puis sessionStorage
        let storage = localStorage;
        let token = localStorage.getItem('authToken');
        
        if (!token) {
          storage = sessionStorage;
          token = sessionStorage.getItem('authToken');
        }
        
        if (token) {
          const user = storage.getItem('authUser');
          const tokenExpiry = storage.getItem('tokenExpiry');
          const rememberMe = storage.getItem('rememberMe') === 'true';
          
          if (user && tokenExpiry) {
            const expiry = parseInt(tokenExpiry);
            
            // Vérifier si le token n'est pas expiré
            if (Date.now() < expiry) {
              this.token = token;
              this.user = JSON.parse(user);
              this.tokenExpiry = expiry;
              this.rememberMe = rememberMe;
              
              // Restaurer l'état du mode admin
              const adminMode = storage.getItem('adminMode') === 'true';
              if (this.user?.isGlobalAdmin && adminMode) {
                this.adminMode = true;
              }
            } else {
              // Token expiré, nettoyer
              this.logout();
              // Rediriger vers login si on est sur une page protégée
              if (import.meta.client) {
                const route = useRoute();
                const protectedRoutes = ['/profile', '/favorites', '/my-conventions', '/conventions/add', '/editions/add'];
                const protectedPatterns = ['/edit', '/gestion', '/covoiturage', '/editions/add'];
                
                const isProtectedRoute = protectedRoutes.some(r => route.path.startsWith(r)) ||
                                       protectedPatterns.some(p => route.path.includes(p));
                
                if (isProtectedRoute) {
                  navigateTo('/login');
                }
              }
            }
          }
        }
      }
    },
    
    checkTokenExpiry() {
      if (this.token && this.tokenExpiry && Date.now() >= this.tokenExpiry) {
        this.logout();
        // Rediriger vers la page de connexion si on est sur une page protégée
        if (import.meta.client) {
          const route = useRoute();
          const protectedRoutes = ['/profile', '/favorites', '/my-conventions', '/conventions/add', '/editions/add'];
          const protectedPatterns = ['/edit', '/gestion', '/covoiturage', '/editions/add'];
          
          const isProtectedRoute = protectedRoutes.some(r => route.path.startsWith(r)) ||
                                 protectedPatterns.some(p => route.path.includes(p));
          
          if (isProtectedRoute) {
            navigateTo('/login');
          }
        }
      }
    },
    
    updateUser(updatedUser: Partial<User>) {
      if (this.user) {
        this.user = { ...this.user, ...updatedUser };
        
        // Mettre à jour le localStorage/sessionStorage
        if (import.meta.client) {
          const storage = this.rememberMe ? localStorage : sessionStorage;
          storage.setItem('authUser', JSON.stringify(this.user));
        }
      }
    },
    
    enableAdminMode() {
      if (this.user?.isGlobalAdmin) {
        this.adminMode = true;
        // Sauvegarder l'état du mode admin
        if (import.meta.client) {
          const storage = this.rememberMe ? localStorage : sessionStorage;
          storage.setItem('adminMode', 'true');
        }
      }
    },
    
    disableAdminMode() {
      this.adminMode = false;
      // Supprimer l'état du mode admin
      if (import.meta.client) {
        localStorage.removeItem('adminMode');
        sessionStorage.removeItem('adminMode');
      }
    },
  },
});
