(() => {
  const picker = document.querySelector('.language');
  const buttons = [...picker.querySelectorAll('button')];
  const translations = [...document.querySelectorAll('[data-ru], [data-ru-label]')].map(element => {
    const attribute = element.hasAttribute('data-ru-label') ? 'aria-label' : null;
    const english = attribute ? element.getAttribute(attribute) : element.textContent;
    const russian = attribute ? element.dataset.ruLabel : element.dataset.ru;
    return { element, attribute, english, russian };
  });

  function selectLanguage(language) {
    document.documentElement.lang = language;
    for (const { element, attribute, english, russian } of translations) {
      const value = language === 'ru' ? russian : english;
      if (attribute) element.setAttribute(attribute, value);
      else element.textContent = value;
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    }
  }

  let savedLanguage;
  try {
    savedLanguage = localStorage.getItem('site-language');
  } catch {
    // Switching still works when browser storage is unavailable.
  }
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
  const current = nav.querySelector('[aria-current="page"]');
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
      const stretch = Math.min(18, current.offsetWidth * .2);
      const overshoot = direction * Math.min(4, Math.abs(distance) * .05);
      const middleLeft = previous.offsetLeft + distance * .56;
      const middleWidth = Math.max(previous.offsetWidth, current.offsetWidth);
      glass.animate([
        { ...shape(previous), easing: 'cubic-bezier(.4,0,.7,.7)' },
        {
          offset: .46,
          left: (middleLeft + Math.min(0, direction * stretch)) + 'px',
          width: (middleWidth + stretch) + 'px',
          easing: 'cubic-bezier(.2,.4,.3,1)'
        },
        { ...shape(current), left: (current.offsetLeft + overshoot) + 'px', offset: .75, easing: 'ease-in-out' },
        shape(current)
      ], { duration: 480 });
    }
  }
  function previousLink() {
    let url = document.referrer;
    try {
      url = sessionStorage.getItem('nav-from') || url;
      sessionStorage.removeItem('nav-from');
    } catch {}
    return links.find(link => link.href === url);
  }
  arrive(previousLink());
  window.addEventListener('pagehide', () => {
    try { sessionStorage.setItem('nav-from', current.href); } catch {}
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) arrive(previousLink());
  });
  const observer = new ResizeObserver(position);
  links.forEach(link => observer.observe(link));
})();
