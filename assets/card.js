const stage = document.querySelector('.stage');
const toggle = stage.querySelector('button');
const card = stage.querySelector('.card');
stage.addEventListener('click', event => {
  if (event.target.closest('a')) return;
  const flipped = card.classList.toggle('flipped');
  card.querySelector('.front').inert = flipped;
  card.querySelector('.back').inert = !flipped;
  toggle.setAttribute('aria-pressed', String(flipped));
});
