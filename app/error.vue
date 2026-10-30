<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
</script>
<template>
  <main class="mx-auto max-w-lg space-y-6 p-6 pt-16">
    <PageTitle>{{ error.statusCode === 404 ? 'Page introuvable' : 'Une erreur est survenue' }}</PageTitle>
    <p>{{ error.statusCode === 404 ? 'Cette page n’existe pas.' : 'Le service est momentanément indisponible. Veuillez réessayer.' }}</p>
    <button @click="clearError({ redirect: '/connexion' })">Revenir à la connexion</button>
  </main>
</template>
