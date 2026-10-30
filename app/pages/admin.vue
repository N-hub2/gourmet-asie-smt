<script setup lang="ts">
definePageMeta({ middleware: 'staff' })
const resource = ref('categories')
const name = ref('')
const parentId = ref('')
const price = ref<number>(0)
const capacity = ref<number>(2)
const message = ref('')
const { data: rows, refresh, error } = await useFetch<Array<{ id: string; name: string; active: boolean }>>(() => `/api/management/${resource.value}`)
const { data: categories } = await useFetch<Array<{ id: string; name: string }>>('/api/management/categories')
const { data: products } = await useFetch<Array<{ id: string; name: string }>>('/api/management/products')
async function create() {
  message.value = ''
  const body = { name: name.value, ...(resource.value === 'products' ? { categoryId: parentId.value } : {}), ...(resource.value === 'variants' ? { productId: parentId.value, priceCents: price.value } : {}), ...(resource.value === 'tables' ? { capacity: capacity.value } : {}) }
  try { await $fetch(`/api/management/${resource.value}`, { method: 'POST', body }); name.value = ''; await refresh(); message.value = 'Enregistrement créé.' }
  catch { message.value = 'Enregistrement impossible. Vérifiez les données et les doublons.' }
}
watch(resource, () => { parentId.value = ''; message.value = '' })
</script>
<template>
  <main class="mx-auto max-w-3xl space-y-6 p-6">
    <NuxtLink to="/personnel">Retour à l’espace du personnel</NuxtLink>
    <PageTitle>Administration</PageTitle>
    <label><span>Gestion</span><select v-model="resource"><option value="categories">Catégories de boissons</option><option value="products">Produits</option><option value="variants">Variantes et tarifs</option><option value="tables">Tables du restaurant</option></select></label>
    <p v-if="error" role="alert">Chargement impossible.</p>
    <ul class="space-y-2"><li v-for="row in rows" :key="row.id" class="rounded border p-3">{{ row.name }} — {{ row.active ? 'Actif' : 'Inactif' }}<small class="block break-all">{{ row.id }}</small></li></ul>
    <p v-if="!rows?.length">Aucun enregistrement.</p>
    <form class="space-y-4" @submit.prevent="create">
      <h2 class="text-xl">Ajouter un enregistrement</h2>
      <label><span>Nom</span><input v-model="name" required maxlength="120"></label>
      <label v-if="resource === 'products'"><span>Catégorie</span><select v-model="parentId" required><option value="">Choisir une catégorie</option><option v-for="item in categories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
      <label v-if="resource === 'variants'"><span>Produit</span><select v-model="parentId" required><option value="">Choisir un produit</option><option v-for="item in products" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
      <label v-if="resource === 'variants'"><span>Prix en centimes d’euro</span><input v-model.number="price" type="number" min="0" max="10000000" step="1" required></label>
      <label v-if="resource === 'tables'"><span>Nombre de places</span><input v-model.number="capacity" type="number" min="1" max="100" required></label>
      <button>Ajouter</button><p role="status">{{ message }}</p>
    </form>
  </main>
</template>
