import './style.css';
import sampleCoverUrl from './assets/sample-cover.svg';
import { PreviewEngine } from './preview/PreviewEngine';

const host = document.querySelector<HTMLElement>('#preview');

if (!host) {
  throw new Error('Preview host element was not found.');
}

const preview = new PreviewEngine(host);

try {
  await preview.start(sampleCoverUrl);
} catch (error) {
  console.error(error);
  host.textContent = 'The artwork preview could not be loaded.';
  host.classList.add('preview-error');
}

window.addEventListener('pagehide', () => preview.destroy(), { once: true });
