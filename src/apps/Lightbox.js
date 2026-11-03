/**
 * Full-screen view of one photo with its caption. Closes on click, or on Esc
 * (caught before the scene's own Esc handler, so the close-up stays put).
 */
export class Lightbox {
  constructor(element) {
    this.element = element;
    this.image = element.querySelector('img');
    this.caption = element.querySelector('figcaption');
    element.addEventListener('click', () => this.close());
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          e.stopImmediatePropagation();
          this.close();
        }
      },
      true
    );
  }

  get isOpen() {
    return this.element.classList.contains('is-open');
  }

  /** `source` is a Blob (a user photo) or a canvas (a placeholder). */
  open(source, caption) {
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = source instanceof Blob ? URL.createObjectURL(source) : null;
    this.image.src = this.url ?? source.toDataURL('image/jpeg', 0.9);
    this.image.alt = caption || 'Photo';
    this.caption.textContent = caption;
    this.element.classList.add('is-open');
    this.element.focus({ preventScroll: true });
  }

  close() {
    this.element.classList.remove('is-open');
  }
}
