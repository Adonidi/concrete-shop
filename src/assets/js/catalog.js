function initCatalogPage() {
  const grid = document.querySelector('#catalog-grid');
  const filters = document.querySelector('#category-filters');
  const search = document.querySelector('#catalog-search');
  const meta = document.querySelector('#results-meta');
  if (!grid || !filters || !search || !meta) return;

  const state = { products: [], category: 'Усі', query: '' };

  function renderFilters() {
    const categories = ['Усі', ...new Set(state.products.map(product => product.category))];
    filters.innerHTML = categories.map(category => `
      <button class="filter-btn ${category === state.category ? 'active' : ''}" data-category="${escapeHtml(category)}">
        ${escapeHtml(category)}
      </button>`).join('');
  }

  function renderProducts() {
    const query = state.query.trim().toLocaleLowerCase('uk-UA');
    const visible = state.products.filter(product => {
      const byCategory = state.category === 'Усі' || product.category === state.category;
      const bySearch = !query || product.name.toLocaleLowerCase('uk-UA').includes(query);
      return byCategory && bySearch;
    });

    meta.textContent = `Знайдено: ${visible.length}`;
    grid.innerHTML = visible.length
      ? visible.map(productCard).join('')
      : '<div class="empty" style="grid-column:1/-1">Нічого не знайдено. Змініть пошук або категорію.</div>';
  }

  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    renderFilters();
    renderProducts();
  });

  search.addEventListener('input', event => {
    state.query = event.target.value;
    renderProducts();
  });

  try {
    state.products = getProducts();
    renderFilters();
    renderProducts();
    initProductCardModal();
  } catch (error) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Не вдалося завантажити каталог.</div>';
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', initCatalogPage);
document.addEventListener('tvoryvo:navigate', initCatalogPage);
