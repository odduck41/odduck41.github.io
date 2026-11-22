const stage = document.querySelector('.stage');
const toggle = stage.querySelector('button');
const card = stage.querySelector('.card');
let hovering = false;
let activated = false;

function updateCard() {
  const flipped = hovering || activated;
  card.classList.toggle('flipped', flipped);
  card.querySelector('.front').inert = flipped;
  card.querySelector('.back').inert = !flipped;
  toggle.setAttribute('aria-pressed', String(flipped));
}

stage.addEventListener('pointerenter', event => {
  hovering = event.pointerType === 'mouse';
  updateCard();
});
stage.addEventListener('pointerleave', () => {
  hovering = false;
  updateCard();
});
stage.addEventListener('click', event => {
  if (event.target.closest('a') || (hovering && event.detail !== 0)) return;
  activated = !activated;
  updateCard();
});
