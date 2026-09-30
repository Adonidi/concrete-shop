function getProducts() {
  if (!Array.isArray(window.PRODUCTS)) {
    throw new Error('Каталог товарів не завантажено');
  }

  return window.PRODUCTS;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function nl2br(value) {
  return escapeHtml(value || '').replaceAll('\n', '<br>');
}

function productCard(product) {
  return `
    <article class="product-card" data-product-id="${escapeHtml(product.id)}" tabindex="0" role="button" aria-label="Відкрити товар ${escapeHtml(product.name)}">
      <div class="product-media">
        <img class="product-image" src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy">
      </div>
      <div class="product-body">
        <div class="product-category">${escapeHtml(product.category)}</div>
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <div class="product-details">${nl2br(product.details)}</div>
      </div>
    </article>`;
}

function ensureProductModal() {
  if (document.querySelector('#product-modal')) return;

  const modal = document.createElement('div');
  modal.className = 'product-modal';
  modal.id = 'product-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="product-modal__backdrop" data-close-modal></div>
    <div class="product-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
      <button class="product-modal__close" type="button" aria-label="Закрити" data-close-modal>×</button>
      <div class="product-modal__grid">
        <div class="product-modal__media">
          <img class="product-modal__image" src="" alt="">
        </div>
        <div class="product-modal__content">
          <div class="product-modal__category"></div>
          <h2 class="product-modal__title" id="product-modal-title"></h2>
          <div class="product-modal__details"></div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);

  modal.addEventListener('click', event => {
    if (event.target.closest('[data-close-modal]')) {
      closeProductModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeProductModal();
    }
  });
}

function openProductModal(product) {
  ensureProductModal();

  const modal = document.querySelector('#product-modal');
  modal.querySelector('.product-modal__image').src = product.image;
  modal.querySelector('.product-modal__image').alt = product.name;
  modal.querySelector('.product-modal__category').textContent = product.category;
  modal.querySelector('.product-modal__title').textContent = product.name;
  modal.querySelector('.product-modal__details').innerHTML = nl2br(product.details);

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeProductModal() {
  const modal = document.querySelector('#product-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function initProductCardModal() {
  ensureProductModal();
  if (document.documentElement.dataset.productModalBound === 'true') return;
  document.documentElement.dataset.productModalBound = 'true';

  document.addEventListener('click', event => {
    const card = event.target.closest('.product-card[data-product-id]');
    if (!card) return;
    const product = getProducts().find(item => item.id === card.dataset.productId);
    if (product) openProductModal(product);
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.product-card[data-product-id]');
    if (!card) return;
    event.preventDefault();
    const product = getProducts().find(item => item.id === card.dataset.productId);
    if (product) openProductModal(product);
  });
}
