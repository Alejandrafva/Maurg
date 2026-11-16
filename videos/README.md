# Videos MAURG (Reels / TikTok / Historias, 1080×1920)

| Video | Duración | Contenido |
|---|---|---|
| `out/01-conoce-maurg.mp4` | 28 s | Presentación: qué es MAURG, qué vende, marcas, ubicación (Valencia · Paraparal), envíos, pagos, mayor, contacto |
| `out/02-nuevos-ingresos.mp4` | 20 s | Carrusel de 12 carteras disponibles |
| `out/03-regalos.mp4` | 19 s | Guía de regalos con cinta, 8 carteras numeradas y cierre para apartar |

Los videos no llevan música: agrega un audio en tendencia al subirlos en Instagram/TikTok.

## Cómo editar y volver a generar
- Textos, tiempos y carteras: `src/v1-conoce-maurg.html`, `src/v2-nuevos-ingresos.html`, `src/v3-regalos.html`.
- Colores e iconos: `src/lib.js` (objeto `C` e `ICON`).
- Carteras sin fondo (PNG): `assets/bags/`.

```bash
cd videos
NODE_PATH=$(npm root -g) node render.cjs src/v1-conoce-maurg.html out/01-conoce-maurg.mp4 30
```
Requiere Node, Playwright (Chromium) y ffmpeg.
