function initHomePage() {
  const root = document.querySelector('#featured-products');
  if (!root) return;

  try {
    const products = getProducts();
    const featured = products.filter(item => item.featured).slice(0, 6);
    root.innerHTML = featured.map(productCard).join('');
    initProductCardModal();
  } catch (error) {
    root.innerHTML = '<div class="empty">Не вдалося завантажити товари.</div>';
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', initHomePage);
document.addEventListener('tvoryvo:navigate', initHomePage);
