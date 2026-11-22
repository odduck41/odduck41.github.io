const timeline = document.querySelector('.tl');
const first = timeline.firstElementChild;
const last = timeline.lastElementChild;

function updateTimeline() {
  const scroller = document.scrollingElement;
  const scrollRange = scroller.scrollHeight - scroller.clientHeight;
  const progress = scrollRange > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / scrollRange)) : 0;
  timeline.style.setProperty('--progress-offset', (last.offsetTop - first.offsetTop) * progress + 'px');
}

window.addEventListener('scroll', updateTimeline, { passive: true });
window.addEventListener('resize', updateTimeline);
const observer = new ResizeObserver(updateTimeline);
for (const milestone of timeline.children) observer.observe(milestone);
updateTimeline();
