const sectionURL = new URL('../writing/', import.meta.url);
const list = document.querySelector('#articles');
const error = document.querySelector('#load-error');
async function loadArticle(path) {
  const url = new URL('../' + path.split('/').map(encodeURIComponent).join('/'), sectionURL);
  const response = await fetch(url);
  if (!response.ok) throw new Error(response.statusText);
  const html = new DOMParser().parseFromString(await response.text(), 'text/html');
  const link = document.createElement('a');
  link.textContent = html.title.trim() || path.split('/').pop().slice(0, -5);
  link.href = url.href;
  const row = document.createElement('li');
  row.append(link);
  return row;
}
try {
  // GitHub Pages builds the catalog. Plain static servers use the JSON manifest.
  let response = await fetch(new URL('discovered.json',sectionURL));
  if (response.status === 404) response = await fetch(new URL('files.json',sectionURL));
  if (!response.ok) throw new Error(response.statusText);
  const files = await response.json();
  const articles = await Promise.allSettled(files.map(loadArticle));
  for (const article of articles) {
    if (article.status === 'fulfilled') list.append(article.value);
    else error.hidden = false;
  }
} catch {
  error.hidden = false;
}
