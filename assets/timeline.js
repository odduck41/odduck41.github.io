const timeline = document.querySelector('.tl');
const first = timeline.firstElementChild;
const last = timeline.lastElementChild;

let initialized = false;
function updateTimeline() {
  if (!timeline.getClientRects().length) return;
  const scroller = document.scrollingElement;
  const scrollRange = scroller.scrollHeight - scroller.clientHeight;
  const progress = scrollRange > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / scrollRange)) : 0;
  const offset = (last.offsetTop - first.offsetTop) * progress;
  timeline.style.setProperty('--progress-offset', offset + 'px');
  for (const mark of timeline.children) {
    const passed = mark.offsetTop - first.offsetTop <= offset;
    if (initialized && passed !== mark.classList.contains('passed')) {
      mark.classList.toggle('ripple', passed);
    }
    mark.classList.toggle('passed',passed);
  }
  initialized = true;
}

window.addEventListener('scroll', updateTimeline, { passive: true });
window.addEventListener('resize', updateTimeline);
const observer = new ResizeObserver(updateTimeline);
for (const milestone of timeline.children) observer.observe(milestone);
updateTimeline();
