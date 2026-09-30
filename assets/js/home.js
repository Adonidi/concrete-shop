(() => {
  const root = document.querySelector('#featured-products');
  if (!root) return;

  try {
    const products = getProducts();
    const featured = products.filter(x => x.featured).slice(0, 4);
    root.innerHTML = featured.map(productCard).join('');
    initProductCardModal();
  } catch (error) {
    root.innerHTML = '<div class="empty">Не вдалося завантажити товари.</div>';
    console.error(error);
  }
})();
