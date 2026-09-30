const GALLERY_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'ogv']
};

function escapeHtmlGallery(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function mediaTypeByPath(path) {
  const clean = String(path).split('?')[0].split('#')[0];
  const ext = clean.includes('.') ? clean.split('.').pop().toLowerCase() : '';
  if (GALLERY_EXTENSIONS.video.includes(ext)) return 'video';
  if (GALLERY_EXTENSIONS.image.includes(ext)) return 'image';
  return null;
}

function normalizeGalleryHref(href) {
  try {
    const folderUrl = new URL('gallery/', window.location.href);
    const resolved = new URL(href, folderUrl);
    if (resolved.origin !== folderUrl.origin || !resolved.pathname.startsWith(folderUrl.pathname)) return null;
    const type = mediaTypeByPath(resolved.pathname);
    if (!type) return null;
    const fileName = decodeURIComponent(resolved.pathname.split('/').pop());
    return { src: `gallery/${encodeURIComponent(fileName)}`, type };
  } catch {
    return null;
  }
}

async function readGalleryFolder() {
  // On servers that expose a directory index (for example Python http.server),
  // new media placed in /gallery is discovered automatically.
  try {
    const response = await fetch('gallery/', { cache: 'no-store' });
    if (!response.ok) return [];
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = [];
    const seen = new Set();
    for (const anchor of doc.querySelectorAll('a[href]')) {
      const item = normalizeGalleryHref(anchor.getAttribute('href'));
      if (!item || seen.has(item.src)) continue;
      seen.add(item.src);
      items.push(item);
    }
    return items;
  } catch {
    return [];
  }
}

function manifestGalleryItems() {
  return Array.isArray(window.GALLERY_ITEMS)
    ? window.GALLERY_ITEMS.map(item => ({ src: item.src, type: item.type || mediaTypeByPath(item.src), poster: item.poster || null })).filter(item => item.type)
    : [];
}

function galleryCard(item, index) {
  const label = item.type === 'video' ? 'Відкрити відео' : 'Відкрити фото';
  const poster = item.poster ? ` poster="${escapeHtmlGallery(item.poster)}"` : '';
  const media = item.type === 'video'
    ? `<video class="gallery-thumb-media" src="${escapeHtmlGallery(item.src)}"${poster} muted playsinline preload="metadata" aria-hidden="true"></video><span class="gallery-play" aria-hidden="true">▶</span>`
    : `<img class="gallery-thumb-media" src="${escapeHtmlGallery(item.src)}" alt="Виконана робота ${index + 1}" loading="lazy">`;

  return `<button class="gallery-card" type="button" data-gallery-index="${index}" aria-label="${label}">${media}</button>`;
}

function ensureGalleryModal() {
  let modal = document.querySelector('#gallery-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'gallery-modal';
  modal.className = 'gallery-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="gallery-modal__backdrop" data-gallery-close></div>
    <div class="gallery-modal__dialog" role="dialog" aria-modal="true" aria-label="Перегляд роботи">
      <button class="gallery-modal__close" type="button" aria-label="Закрити" data-gallery-close>×</button>
      <button class="gallery-modal__nav gallery-modal__prev" type="button" aria-label="Попередня робота" data-gallery-prev>‹</button>
      <div class="gallery-modal__stage"></div>
      <button class="gallery-modal__nav gallery-modal__next" type="button" aria-label="Наступна робота" data-gallery-next>›</button>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

let galleryItems = [];
let galleryIndex = 0;

function renderGalleryModalItem() {
  const modal = ensureGalleryModal();
  const stage = modal.querySelector('.gallery-modal__stage');
  const item = galleryItems[galleryIndex];
  if (!item) return;

  stage.innerHTML = item.type === 'video'
    ? `<video class="gallery-modal__media" src="${escapeHtmlGallery(item.src)}" controls autoplay playsinline preload="metadata"></video>`
    : `<img class="gallery-modal__media" src="${escapeHtmlGallery(item.src)}" alt="Виконана робота">`;

  const showNav = galleryItems.length > 1;
  modal.querySelector('[data-gallery-prev]').hidden = !showNav;
  modal.querySelector('[data-gallery-next]').hidden = !showNav;
}

function openGalleryModal(index) {
  galleryIndex = index;
  const modal = ensureGalleryModal();
  renderGalleryModalItem();
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeGalleryModal() {
  const modal = document.querySelector('#gallery-modal');
  if (!modal) return;
  const video = modal.querySelector('video');
  if (video) video.pause();
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  modal.querySelector('.gallery-modal__stage').innerHTML = '';
  document.body.classList.remove('modal-open');
}

function moveGallery(step) {
  if (!galleryItems.length) return;
  galleryIndex = (galleryIndex + step + galleryItems.length) % galleryItems.length;
  renderGalleryModalItem();
}

function bindGalleryModal() {
  const modal = ensureGalleryModal();
  modal.addEventListener('click', event => {
    if (event.target.closest('[data-gallery-close]')) closeGalleryModal();
    if (event.target.closest('[data-gallery-prev]')) moveGallery(-1);
    if (event.target.closest('[data-gallery-next]')) moveGallery(1);
  });

  document.addEventListener('keydown', event => {
    if (!modal.classList.contains('is-open')) return;
    if (event.key === 'Escape') closeGalleryModal();
    if (event.key === 'ArrowLeft') moveGallery(-1);
    if (event.key === 'ArrowRight') moveGallery(1);
  });
}

async function initGalleryPage() {
  const grid = document.querySelector('#gallery-grid');
  if (!grid) return;

  const folderItems = await readGalleryFolder();
  const manifestItems = manifestGalleryItems();
  const manifestBySrc = new Map(manifestItems.map(item => [item.src, item]));
  galleryItems = folderItems.length
    ? folderItems.map(item => ({ ...item, ...(manifestBySrc.get(item.src) || {}) }))
    : manifestItems;
  grid.innerHTML = galleryItems.length
    ? galleryItems.map(galleryCard).join('')
    : '<div class="empty" style="grid-column:1/-1">Галерея поки порожня.</div>';

  grid.addEventListener('click', event => {
    const card = event.target.closest('[data-gallery-index]');
    if (!card) return;
    openGalleryModal(Number(card.dataset.galleryIndex));
  });

  bindGalleryModal();
}

async function initGalleryPreview() {
  const preview = document.querySelector('#gallery-preview');
  if (!preview) return;
  const items = await readGalleryFolder();
  const manifestItems = manifestGalleryItems();
  const manifestBySrc = new Map(manifestItems.map(item => [item.src, item]));
  const source = items.length ? items.map(item => ({ ...item, ...(manifestBySrc.get(item.src) || {}) })) : manifestItems;
  const selected = source.slice(0, 3);
  preview.innerHTML = selected.map((item, index) => {
    if (item.type === 'video') {
      return `<a class="work gallery-preview-item" href="gallery.html" aria-label="Перейти до галереї"><video src="${escapeHtmlGallery(item.src)}" muted playsinline preload="metadata"></video><span class="gallery-play" aria-hidden="true">▶</span></a>`;
    }
    return `<a class="work gallery-preview-item" href="gallery.html" aria-label="Перейти до галереї"><img src="${escapeHtmlGallery(item.src)}" alt="Виконана робота ${index + 1}" loading="lazy"></a>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  initGalleryPage();
  initGalleryPreview();
});
