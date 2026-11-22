(() => {
  const picker = document.querySelector('.language');
  const buttons = [...picker.querySelectorAll('button')];
  const english = new WeakMap();
  function selectLanguage(language) {
    document.documentElement.lang = language;
    for (const element of document.querySelectorAll('[data-ru], [data-ru-label]')) {
      const label = element.hasAttribute('data-ru-label');
      if (!english.has(element)) english.set(element, label ? element.getAttribute('aria-label') : (element.dataset.en ?? element.textContent));
      const value = language === 'ru' ? (label ? element.dataset.ruLabel : element.dataset.ru) : english.get(element);
      if (label) element.setAttribute('aria-label', value);
      else element.textContent = value;
    }
    document.dispatchEvent(new Event('sitelanguagechange'));
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    }
  }

  document.addEventListener('sectionchange', () => selectLanguage(document.documentElement.lang));
  let savedLanguage;
  try {
    savedLanguage = localStorage.getItem('site-language');
  } catch {
    // Switching still works when browser storage is unavailable.
  }
  document.querySelector('title').dataset.en = document.title;
  selectLanguage(savedLanguage === 'ru' ? 'ru' : 'en');
  picker.hidden = false;
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const language = button.dataset.language;
      selectLanguage(language);
      try {
        localStorage.setItem('site-language', language);
      } catch {
        // Keep the current selection even if it cannot be saved.
      }
    });
  }
})();

document.documentElement.classList.remove('ru-pending');

(() => {
  const nav = document.querySelector('.bar nav');
  const links = Array.from(nav.querySelectorAll('a'));
  let current = nav.querySelector('[aria-current="page"]');
  const glass = nav.querySelector('.nav-selection');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function shape(link) {
    return {
      left: link.offsetLeft + 'px',
      width: link.offsetWidth + 'px'
    };
  }
  function position() {
    Object.assign(glass.style, shape(current), { opacity: 1 });
  }
  function arrive(previous) {
    position();
    if (previous && previous !== current && !reduced.matches) {
      const distance = current.offsetLeft - previous.offsetLeft;
      const direction = Math.sign(distance);
      const stretch = Math.min(26, current.offsetWidth * .28);
      const overshoot = direction * Math.min(7, Math.abs(distance) * .08);
      const middleLeft = previous.offsetLeft + distance * .56;
      const middleWidth = Math.max(previous.offsetWidth, current.offsetWidth);
      glass.animate([
        { ...shape(previous), transform: 'skewX(0deg)', easing: 'cubic-bezier(.4,0,.7,.7)' },
        {
          offset: .46,
          transform: `skewX(${-8 * direction}deg)`,
          left: (middleLeft + Math.min(0, direction * stretch)) + 'px',
          width: (middleWidth + stretch) + 'px',
          easing: 'cubic-bezier(.2,.4,.3,1)'
        },
        { ...shape(current), left: (current.offsetLeft + overshoot) + 'px', offset: .75, transform: `skewX(${2 * direction}deg)`, easing: 'ease-in-out' },
        { ...shape(current), transform: 'skewX(0deg)' }
      ], { duration: 355 });
    }
  }
  function select(link) {
    const previous = current;
    current.removeAttribute('aria-current');
    current = link;
    current.setAttribute('aria-current', 'page');
    for (const animation of glass.getAnimations()) animation.cancel();
    arrive(previous);
  }
  position();
  // Freeze relative URLs before pushState changes the document base.
  for (const link of links) link.href = link.href;
  const pages = new Map();
  const first = document.querySelector('main, #sky');
  pages.set(current.href, Promise.resolve({ node:first, title:document.querySelector('title').dataset.en || document.title,
    ru:document.querySelector('title').dataset.ru, css:document.documentElement.className, scripts:[] }));
  let visible = first;
  let sequence = 0;
  function load(url) {
    if (!pages.has(url)) pages.set(url, fetch(url).then(async response => {
      if (!response.ok) throw Error(response.status);
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const scripts = [...doc.querySelectorAll('body script[src], body script[data-section-script]')]
        .filter(el => !el.src.endsWith('/language.js'))
        .map(el => ({src:el.hasAttribute('src') ? new URL(el.getAttribute('src'), url).href : null, code:el.textContent, type:el.type}));
      return {node:doc.querySelector('main, #sky'), title:doc.title,
        ru:doc.querySelector('title').dataset.ru, css:doc.documentElement.className, scripts};
    }).catch(error => {pages.delete(url); throw error;}));
    return pages.get(url);
  }
  async function navigate(link, push) {
    const request = ++sequence;
    select(link);
    try {
      const page = await load(link.href);
      if (request !== sequence) return;
      if (push) history.pushState(null, '', link.href);
      visible.hidden = true;
      if (!document.body.contains(page.node)) document.body.append(page.node);
      visible = page.node;
      visible.hidden = false;
      document.documentElement.className = page.css;
      const title = document.createElement('title');
      title.textContent = page.title;
      title.dataset.ru = page.ru;
      document.querySelector('title').replaceWith(title);
      document.dispatchEvent(new Event('sectionchange'));
      window.scrollTo(0, 0);
      if (!page.started) {
        page.started = true;
        for (const asset of page.scripts) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            if (!asset.src) {
              script.textContent = asset.code;
              document.body.append(script);
              resolve();
              return;
            }
            script.src = asset.src;
            script.type = asset.type;
            script.onload = resolve;
            script.onerror = reject;
            document.body.append(script);
          });
        }
      }
    } catch {
      if (request === sequence) location.assign(link.href);
    }
  }
  nav.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || location.protocol === 'file:' || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (link !== current) navigate(link, true);
  });
  window.addEventListener('popstate', () => {
    const link = links.find(item => new URL(item.href).pathname === location.pathname.replace(/index\.html$/, ''));
    if (link) navigate(link, false);
  });
  nav.addEventListener('pointerover', event => {
    const link = event.target.closest('a');
    if (link && location.protocol !== 'file:') load(link.href).catch(() => {});
  });
  const observer = new ResizeObserver(position);
  links.forEach(link => observer.observe(link));
})();
