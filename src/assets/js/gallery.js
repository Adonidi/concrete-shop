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
  if (modal.dataset.bound === 'true') return;
  modal.dataset.bound = 'true';

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

function readMediaAspect(item) {
  return new Promise(resolve => {
    if (item.type === 'video') {
      const video = document.createElement('video');
      const done = ratio => {
        video.src = '';
        resolve({ ...item, ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 1.33 });
      };
      video.preload = 'metadata';
      video.muted = true;
      video.onloadedmetadata = () => done(video.videoWidth / video.videoHeight);
      video.onerror = () => done(1.33);
      video.src = item.src;
      return;
    }

    const image = new Image();
    const done = ratio => resolve({ ...item, ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 1 });
    image.onload = () => done(image.naturalWidth / image.naturalHeight);
    image.onerror = () => done(1);
    image.src = item.src;
  });
}

function pickShapeAwarePreview(items) {
  if (!items.length) return [];

  const indexed = items.map((item, index) => ({ item, index }));
  const used = new Set();
  const takeEntry = entry => {
    if (!entry || used.has(entry.index)) return null;
    used.add(entry.index);
    return entry.item;
  };
  const available = () => indexed.filter(entry => !used.has(entry.index));

  // One clearly vertical image, then the two widest images.
  const portrait = takeEntry([...indexed].sort((a, b) => a.item.ratio - b.item.ratio)[0]);
  const widest = available().sort((a, b) => b.item.ratio - a.item.ratio);
  const wideA = takeEntry(widest[0]);
  const wideB = takeEntry(available().sort((a, b) => b.item.ratio - a.item.ratio)[0]);

  // The right column gets images closest to square so the small tiles stay readable.
  const small = available()
    .sort((a, b) => Math.abs(Math.log(a.item.ratio || 1)) - Math.abs(Math.log(b.item.ratio || 1)))
    .slice(0, 3)
    .map(takeEntry)
    .filter(Boolean);

  return [portrait, wideA, wideB, ...small].filter(Boolean).slice(0, 6);
}

function galleryPreviewCard(item, index, slotClass) {
  const label = item.type === 'video' ? 'Відкрити відео' : 'Відкрити фото';
  const poster = item.poster ? ` poster="${escapeHtmlGallery(item.poster)}"` : '';
  const media = item.type === 'video'
    ? `<video src="${escapeHtmlGallery(item.src)}"${poster} muted playsinline preload="metadata" aria-hidden="true"></video><span class="gallery-play" aria-hidden="true">▶</span>`
    : `<img src="${escapeHtmlGallery(item.src)}" alt="Виконана робота ${index + 1}" loading="lazy">`;

  return `<button class="gallery-preview-item ${slotClass}" type="button" data-gallery-preview-index="${index}" aria-label="${label}">${media}</button>`;
}

async function initGalleryPreview() {
  const preview = document.querySelector('#gallery-preview');
  if (!preview) return;

  const folderItems = await readGalleryFolder();
  const manifestItems = manifestGalleryItems();
  const manifestBySrc = new Map(manifestItems.map(item => [item.src, item]));
  const source = folderItems.length
    ? folderItems.map(item => ({ ...item, ...(manifestBySrc.get(item.src) || {}) }))
    : manifestItems;

  const measured = await Promise.all(source.slice(0, 30).map(readMediaAspect));
  const selected = pickShapeAwarePreview(measured);
  const slots = [
    'preview-slot--tall',
    'preview-slot--wide-a',
    'preview-slot--wide-b',
    'preview-slot--small-a',
    'preview-slot--small-b',
    'preview-slot--small-c'
  ];

  galleryItems = selected;
  preview.classList.add('works-grid--smart');
  preview.innerHTML = selected.length
    ? selected.map((item, index) => galleryPreviewCard(item, index, slots[index] || '')).join('')
    : '<div class="empty" style="grid-column:1/-1">Галерея поки порожня.</div>';

  preview.addEventListener('click', event => {
    const card = event.target.closest('[data-gallery-preview-index]');
    if (!card) return;
    openGalleryModal(Number(card.dataset.galleryPreviewIndex));
  });

  bindGalleryModal();
}

function initGalleryViews() {
  initGalleryPage();
  initGalleryPreview();
}

document.addEventListener('DOMContentLoaded', initGalleryViews);
document.addEventListener('tvoryvo:navigate', initGalleryViews);
