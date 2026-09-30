(() => {
  const pageNames = new Set(['index.html', 'catalog.html', 'gallery.html', 'contacts.html']);
  let navigating = false;

  function pageNameFromUrl(url) {
    const part = url.pathname.split('/').pop();
    return part || 'index.html';
  }

  function isSoftPageLink(anchor) {
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return false;
    const raw = anchor.getAttribute('href') || '';
    if (!raw || raw.startsWith('#') || raw.startsWith('tel:') || raw.startsWith('mailto:')) return false;
    try {
      const url = new URL(raw, window.location.href);
      return url.origin === window.location.origin && pageNames.has(pageNameFromUrl(url));
    } catch {
      return false;
    }
  }

  function syncSeoHead(doc) {
    document.title = doc.title || document.title;
    if (doc.documentElement?.lang) document.documentElement.lang = doc.documentElement.lang;

    const metaSelectors = [
      'meta[name="description"]',
      'meta[name="robots"]',
      'meta[name^="twitter:"]',
      'meta[property^="og:"]'
    ];

    for (const selector of metaSelectors) {
      document.head.querySelectorAll(selector).forEach(node => node.remove());
      doc.head.querySelectorAll(selector).forEach(node => document.head.appendChild(node.cloneNode(true)));
    }

    document.head.querySelectorAll('link[rel="canonical"]').forEach(node => node.remove());
    const canonical = doc.head.querySelector('link[rel="canonical"]');
    if (canonical) document.head.appendChild(canonical.cloneNode(true));

    document.head.querySelectorAll('script[type="application/ld+json"][data-seo-jsonld]').forEach(node => node.remove());
    doc.head.querySelectorAll('script[type="application/ld+json"][data-seo-jsonld]').forEach(node => {
      document.head.appendChild(node.cloneNode(true));
    });
  }

  function updateActiveNav(url) {
    const current = pageNameFromUrl(url);
    document.querySelectorAll('.nav a').forEach(anchor => {
      let active = false;
      try {
        const linkUrl = new URL(anchor.href, window.location.href);
        active = pageNameFromUrl(linkUrl) === current;
      } catch {}
      anchor.classList.toggle('active', active);
    });
  }

  async function loadPage(url, { push = true } = {}) {
    if (navigating) return;
    navigating = true;
    document.documentElement.classList.add('is-navigating');

    try {
      const response = await fetch(url.href, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nextMain = doc.querySelector('main');
      const currentMain = document.querySelector('main');
      if (!nextMain || !currentMain) throw new Error('Main content not found');

      closeProductModal?.();
      if (typeof closeGalleryModal === 'function') closeGalleryModal();

      currentMain.replaceWith(nextMain);
      syncSeoHead(doc);

      if (push) history.pushState({}, '', url.href);
      updateActiveNav(url);
      document.dispatchEvent(new CustomEvent('tvoryvo:navigate', { detail: { url: url.href } }));

      if (url.hash) {
        requestAnimationFrame(() => document.querySelector(url.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    } catch (error) {
      // If the site is opened as file:// or the host blocks fetch, keep normal static navigation working.
      if (push) window.location.href = url.href;
      else window.location.reload();
    } finally {
      navigating = false;
      document.documentElement.classList.remove('is-navigating');
    }
  }

  function scrollToLocalTarget(hash) {
    if (!hash || hash === '#') return false;
    const target = document.querySelector(hash);
    if (!target) return false;

    const header = document.querySelector('.site-header');
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    const desiredTop = Math.max(0, targetTop - headerHeight - 18);
    const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    window.scrollTo({
      top: Math.min(desiredTop, maxTop),
      behavior: 'smooth'
    });
    return true;
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;

    const raw = anchor.getAttribute('href') || '';

    // Local buttons such as "Зв'язатися" on the home page should scroll
    // inside the currently rendered page instead of relying on the browser's
    // default hash jump. This also works after soft navigation replaced <main>.
    if (raw.startsWith('#')) {
      if (scrollToLocalTarget(raw)) {
        event.preventDefault();
        history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${raw}`);
      }
      return;
    }

    if (!isSoftPageLink(anchor)) return;
    const url = new URL(anchor.href, window.location.href);
    event.preventDefault();
    loadPage(url);
  });

  window.addEventListener('popstate', () => loadPage(new URL(window.location.href), { push: false }));
  document.addEventListener('DOMContentLoaded', () => updateActiveNav(new URL(window.location.href)));
})();
