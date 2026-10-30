<script setup lang="ts">
definePageMeta({ middleware: 'staff' })
const { data: staff } = await useFetch('/api/auth/me')
async function logout() { await $fetch('/api/auth/logout', { method: 'POST', body: {} }); await navigateTo('/connexion') }
</script>
<template>
  <main class="mx-auto max-w-3xl space-y-6 p-6">
    <PageTitle>Espace du personnel</PageTitle>
    <p>{{ staff?.email }}</p>
    <NuxtLink v-if="staff?.role === 'ADMIN'" to="/admin">Administration</NuxtLink>
    <p>Le module de prise de commande sera disponible lors d’une prochaine étape.</p>
    <button @click="logout">Se déconnecter</button>
  </main>
</template>
