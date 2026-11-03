# Cozy Desk Studio

A cozy, late-evening study desk in 3D that you can set up and actually use. Built with Three.js.

## What's in it

- **Seated view with close-ups:** click any object and the camera moves in close.
- **Warm lamp lighting:** a desk lamp you can switch on and off, a flickering candle you can blow out, soft shadows, bloom and depth of field.
- **Arrange mode:** drag, rotate, add and remove objects on the desk, with collision checks. The layout is saved in your browser.
- **Laptop:** a focus timer (25/5/15) and ambient sounds (rain, fireplace, night breeze), all generated with the Web Audio API.
- **Notebook:** a working to-do list written straight onto the page.
- **Photo wall:** polaroids that hold your own photos, with handwritten captions and a larger view. Also a note-to-self and sticky notes.
- **Clock:** shows your local time and switches between 12- and 24-hour.

Everything you add (photos, notes, to-dos, layout) is stored only in your browser (localStorage and IndexedDB).

## Run it

```bash
npm install
npm run dev
```

Then open the URL that Vite prints. `npm run build` outputs a static site to `dist/`.

## Where things live

- `src/Experience.js`: renderer, scene, render loop and focus handling
- `src/objects/`: room, desk, lamp, and `props/` for everything on the desk and the wall
- `src/setup/`: arrange mode, footprints/collisions and layout storage
- `src/apps/`: focus timer, ambient sounds, laptop desktop, to-do editor, lightbox
- `src/utils/`: procedural textures and paintings, HTML-on-3D overlays, persistence
