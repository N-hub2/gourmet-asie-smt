<script setup lang="ts">
const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)
async function login() {
  pending.value = true; error.value = ''
  try { await $fetch('/api/auth/login', { method: 'POST', body: { email: email.value, password: password.value } }); await navigateTo('/personnel') }
  catch { error.value = 'Connexion impossible. Vérifiez vos identifiants ou réessayez plus tard.' }
  finally { password.value = ''; pending.value = false }
}
</script>
<template>
  <main class="mx-auto max-w-md space-y-6 p-6 pt-16">
    <PageTitle>GOURMET D’ASIE</PageTitle>
    <h2 class="text-xl">Connexion du personnel</h2>
    <form class="space-y-4" @submit.prevent="login">
      <label><span>Adresse e-mail</span><input v-model="email" type="email" autocomplete="username" required maxlength="254"></label>
      <label><span>Mot de passe</span><input v-model="password" type="password" autocomplete="current-password" required maxlength="256"></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <button class="w-full" :disabled="pending">{{ pending ? 'Connexion en cours…' : 'Se connecter' }}</button>
    </form>
    <p class="text-sm">Accès réservé au personnel du restaurant.</p>
  </main>
</template>
