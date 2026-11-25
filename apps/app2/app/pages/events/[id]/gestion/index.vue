<template>
  <div />
</template>

<script setup lang="ts">
/**
 * Accueil de la gestion d'un événement : `/events/:id/gestion`.
 *
 * Le layer bénévoles y renvoie (bouton « Gérer » de la page bénévole, écrit `/editions/:id/gestion`
 * pour app1, réécrit vers `/events/` par le middleware global) : sans cette page, c'était un 404.
 * App1 y a un tableau de bord de tous ses modules ; Flowvent n'en a qu'un, les bénévoles — on mène
 * donc directement à leur configuration, comme la carte « Gestion des bénévoles » de l'événement.
 */
definePageMeta({
  middleware: [
    'subscription',
    (to) => navigateTo(`/events/${to.params.id}/gestion/volunteers/config`, { replace: true }),
  ],
})
</script>
