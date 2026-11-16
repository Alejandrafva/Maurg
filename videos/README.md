# Videos MAURG (Reels / TikTok / Historias, 1080×1920)

| Video | Duración | Contenido |
|---|---|---|
| `out/01-conoce-maurg.mp4` | 28 s | Presentación: qué es MAURG, qué vende, marcas, ubicación (Valencia · Paraparal), envíos, pagos, mayor, contacto |
| `out/02-nuevos-ingresos.mp4` | 20 s | Carrusel de 12 carteras disponibles |
| `out/03-regalos.mp4` | 19 s | Guía de regalos con cinta, 8 carteras numeradas y cierre para apartar |
| `out/04-welcome-maurg.mp4` | 20 s | **Welcome to MAURG.** Editorial de marca con voz en off y música (75 BPM, cortes al ritmo) |
| `out/04-welcome-maurg-solo-musica.mp4` | 20 s | La misma pieza solo con música, para grabar tu propia voz encima |

Los videos 01–03 no llevan música: agrega un audio en tendencia al subirlos en Instagram/TikTok.

## Cómo editar y volver a generar
- Textos, tiempos y carteras: `src/v1-conoce-maurg.html`, `src/v2-nuevos-ingresos.html`, `src/v3-regalos.html`.
- Colores e iconos: `src/lib.js` (objeto `C` e `ICON`).
- Carteras sin fondo (PNG): `assets/bags/`.

```bash
cd videos
NODE_PATH=$(npm root -g) node render.cjs src/v1-conoce-maurg.html out/01-conoce-maurg.mp4 30
```
Requiere Node, Playwright (Chromium) y ffmpeg.

## Audio del video 04
- `audio/musica_welcome.py` genera la música instrumental (sintetizada, libre de derechos): `python3 audio/musica_welcome.py audio/musica-welcome.wav`.
- `audio/voz-welcome.wav` es la voz en off (voz sintética es_MX de Piper). Las frases entran en 1.2 s, 5.0 s, 8.6 s, 11.0 s y 14.0 s.
- Detalles en primer plano (recortes de fotos reales): `assets/details/`.
