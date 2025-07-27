import { defineStore } from 'pinia';
import type { User } from '~/types';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: null as string | null,
    tokenExpiry: null as number | null,
    rememberMe: false,
  }),
  getters: {
    isAuthenticated: (state) => {
      if (!state.token || !state.tokenExpiry) return false;
      // Vérifier si le token n'est pas expiré
      return Date.now() < state.tokenExpiry;
    },
  },
  actions: {
    async register(email: string, password: string, pseudo: string, nom: string, prenom: string) {
      try {
        const response = await $fetch('/api/auth/register', {
          method: 'POST',
          body: { email, password, pseudo, nom, prenom },
        });
        return response;
      } catch (error) {
        throw error;
      }
    },
    async login(identifier: string, password: string, rememberMe: boolean = false) {
      try {
        const response = await $fetch('/api/auth/login', {
          method: 'POST',
          body: { identifier, password },
        });
        
        this.token = response.token;
        this.user = response.user;
        this.rememberMe = rememberMe;
        
        // Calculer l'expiration (1h par défaut)
        this.tokenExpiry = Date.now() + (60 * 60 * 1000); // 1 heure
        
        // Store in localStorage ou sessionStorage selon "Se souvenir de moi"
        if (import.meta.client) {
          const storage = rememberMe ? localStorage : sessionStorage;
          storage.setItem('authToken', response.token);
          storage.setItem('authUser', JSON.stringify(response.user));
          storage.setItem('tokenExpiry', this.tokenExpiry.toString());
          storage.setItem('rememberMe', rememberMe.toString());
        }
        
        return response;
      } catch (error) {
        throw error;
      }
    },
    logout() {
      this.user = null;
      this.token = null;
      this.tokenExpiry = null;
      this.rememberMe = false;
      
      if (import.meta.client) {
        // Nettoyer les deux storages
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('authUser');
        sessionStorage.removeItem('tokenExpiry');
        sessionStorage.removeItem('rememberMe');
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
            } else {
              // Token expiré, nettoyer
              this.logout();
            }
          }
        }
      }
    },
    
    checkTokenExpiry() {
      if (this.token && this.tokenExpiry && Date.now() >= this.tokenExpiry) {
        this.logout();
        // Rediriger vers la page de connexion
        if (import.meta.client) {
          navigateTo('/login');
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
  },
});
