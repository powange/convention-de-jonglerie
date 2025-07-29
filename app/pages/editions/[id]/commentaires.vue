<template>
  <div>
    <div v-if="editionStore.loading">
      <p>Chargement des détails de l'édition...</p>
    </div>
    <div v-else-if="!edition">
      <p>Édition introuvable.</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <EditionHeader 
        :edition="edition" 
        current-page="commentaires" 
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />
      
      <!-- Contenu des commentaires -->
      <div class="space-y-6">
        <!-- Formulaire pour ajouter un nouveau post -->
        <UCard v-if="authStore.isAuthenticated" variant="subtle">
          <template #header>
            <h3 class="text-lg font-semibold">Écrire un commentaire</h3>
          </template>
          
          <UForm :state="newPostForm" :validate="validateNewPost" @submit="submitNewPost">
            <UFormField label="Votre commentaire" name="content" required>
              <UTextarea
                v-model="newPostForm.content"
                placeholder="Partagez votre expérience, posez vos questions..."
                :rows="4"
                :maxlength="2000"
                class="w-full"
              />
              <template #help>
                <div class="flex justify-between text-xs">
                  <span>Partagez votre expérience ou posez vos questions</span>
                  <span :class="newPostForm.content.length > 1800 ? 'text-warning-500' : 'text-gray-500'">
                    {{ newPostForm.content.length }}/2000
                  </span>
                </div>
              </template>
            </UFormField>
            
            <div class="flex justify-end gap-2 mt-4">
              <UButton 
                type="button" 
                color="neutral" 
                variant="ghost"
                @click="newPostForm.content = ''"
              >
                Annuler
              </UButton>
              <UButton 
                type="submit" 
                :loading="isSubmittingPost"
                :disabled="!newPostForm.content.trim()"
              >
                Publier
              </UButton>
            </div>
          </UForm>
        </UCard>

        <!-- Message pour les utilisateurs non connectés -->
        <UCard v-else variant="subtle">
          <div class="text-center py-4">
            <UIcon name="i-heroicons-chat-bubble-left-right" class="text-gray-400 text-4xl mb-2" />
            <p class="text-gray-600 mb-4">Connectez-vous pour participer à la discussion</p>
            <UButton to="/login" color="primary">
              Se connecter
            </UButton>
          </div>
        </UCard>

        <!-- Liste des posts -->
        <div v-if="loading" class="space-y-4">
          <USkeleton class="h-32" v-for="i in 3" :key="i" />
        </div>
        
        <div v-else-if="posts.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="text-gray-400 text-4xl mb-4" />
          <p class="text-gray-600">Aucun commentaire pour le moment.</p>
          <p class="text-gray-500 text-sm">Soyez le premier à partager votre expérience !</p>
        </div>
        
        <div v-else class="space-y-6">
          <EditionPost
            v-for="post in posts"
            :key="post.id"
            :post="post"
            :current-user-id="authStore.user?.id"
            @delete-post="deletePost"
            @add-comment="addComment"
            @delete-comment="deleteComment"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useEditionStore } from '~/stores/editions';
import { useAuthStore } from '~/stores/auth';
import type { Edition } from '~/types';

const route = useRoute();
const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();

const editionId = parseInt(route.params.id as string);
const loading = ref(false);
const posts = ref([]);
const isSubmittingPost = ref(false);

const newPostForm = reactive({
  content: ''
});

const edition = computed(() => editionStore.getEditionById(editionId));

const isFavorited = computed(() => (editionId: number) => {
  return editionStore.editions.find(c => c.id === editionId)?.favoritedBy.some(u => u.id === authStore.user?.id);
});

// Validation du nouveau post
const validateNewPost = (state: any) => {
  const errors = [];
  if (!state.content || !state.content.trim()) {
    errors.push({ path: 'content', message: 'Le contenu est requis' });
  }
  if (state.content && state.content.length > 2000) {
    errors.push({ path: 'content', message: 'Le contenu ne peut pas dépasser 2000 caractères' });
  }
  return errors;
};

// Charger les posts
const loadPosts = async () => {
  loading.value = true;
  try {
    const response = await $fetch(`/api/editions/${editionId}/posts`);
    posts.value = response;
  } catch (error: any) {
    console.error('Erreur lors du chargement des posts:', error);
    toast.add({
      title: 'Erreur de chargement',
      description: 'Impossible de charger les commentaires',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
};

// Soumettre un nouveau post
const submitNewPost = async () => {
  if (!authStore.isAuthenticated) return;
  
  isSubmittingPost.value = true;
  try {
    const newPost = await $fetch(`/api/editions/${editionId}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: {
        content: newPostForm.content.trim()
      }
    });
    
    posts.value.unshift(newPost);
    newPostForm.content = '';
    
    toast.add({
      title: 'Commentaire publié',
      description: 'Votre commentaire a été publié avec succès',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Erreur lors de la création du post:', error);
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de publier le commentaire',
      color: 'error'
    });
  } finally {
    isSubmittingPost.value = false;
  }
};

// Supprimer un post
const deletePost = async (postId: number) => {
  try {
    await $fetch(`/api/editions/${editionId}/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });
    
    posts.value = posts.value.filter(p => p.id !== postId);
    
    toast.add({
      title: 'Commentaire supprimé',
      description: 'Le commentaire a été supprimé avec succès',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Erreur lors de la suppression du post:', error);
    toast.add({
      title: 'Erreur',
      description: 'Impossible de supprimer le commentaire',
      color: 'error'
    });
  }
};

// Ajouter un commentaire à un post
const addComment = async (postId: number, content: string) => {
  try {
    const newComment = await $fetch(`/api/editions/${editionId}/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: { content }
    });
    
    // Trouver le post et ajouter le commentaire
    const post = posts.value.find(p => p.id === postId);
    if (post) {
      post.comments.push(newComment);
    }
    
    toast.add({
      title: 'Réponse publiée',
      description: 'Votre réponse a été publiée avec succès',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Erreur lors de la création du commentaire:', error);
    toast.add({
      title: 'Erreur',
      description: 'Impossible de publier la réponse',
      color: 'error'
    });
  }
};

// Supprimer un commentaire
const deleteComment = async (postId: number, commentId: number) => {
  try {
    await $fetch(`/api/editions/${editionId}/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });
    
    // Trouver le post et supprimer le commentaire
    const post = posts.value.find(p => p.id === postId);
    if (post) {
      post.comments = post.comments.filter(c => c.id !== commentId);
    }
    
    toast.add({
      title: 'Réponse supprimée',
      description: 'La réponse a été supprimée avec succès',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Erreur lors de la suppression du commentaire:', error);
    toast.add({
      title: 'Erreur',
      description: 'Impossible de supprimer la réponse',
      color: 'error'
    });
  }
};

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id);
    toast.add({ title: 'Statut de favori mis à jour !', icon: 'i-heroicons-check-circle', color: 'success' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour du statut de favori', icon: 'i-heroicons-x-circle', color: 'error' });
  }
};

onMounted(async () => {
  if (!edition.value) {
    try {
      const fetchedEdition = await editionStore.fetchEditionById(editionId);
      // Ajouter l'édition au cache local
      const existingIndex = editionStore.editions.findIndex(e => e.id === editionId);
      if (existingIndex === -1) {
        editionStore.editions.push(fetchedEdition);
      } else {
        editionStore.editions[existingIndex] = fetchedEdition;
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'édition:', error);
    }
  }
  await loadPosts();
});
</script>