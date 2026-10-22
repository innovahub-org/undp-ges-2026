# UNDP Gender Equality Strategy 2026–2029 (sitio estático)

Copia estática de https://undp-ges-2026.vercel.app/ para publicarla en GitHub Pages.

- `docs/`: el sitio publicado (GitHub Pages sirve esta carpeta desde la rama `main`).
- `downloads/`: los PDF que aparecen en el diálogo **Download** (estrategia completa y resumen en 6 idiomas). La lista, con el texto y el orden de cada entrada, está en `downloads/downloads.json`. Para agregar, quitar o reemplazar un PDF: cambia el archivo y el JSON, y vuelve a ejecutar `build.mjs`.
- `scripts/mirror.mjs`: descarga el sitio en vivo tal cual (HTML, scripts, estilos, fuentes e íconos).
- `scripts/build.mjs`: lo adapta a un hosting estático. Pasa todas las rutas a relativas (funciona en cualquier subcarpeta o dominio), descarga las imágenes y el PDF de Sanity a `docs/assets/`, desactiva el optimizador de imágenes de Next.js y agrega `.nojekyll`.

## Volver a generar

```sh
node scripts/mirror.mjs raw
node scripts/build.mjs raw docs https://innovahub-org.github.io/undp-ges-2026
```

El tercer argumento es la URL pública final. Solo se usa para las etiquetas para compartir en redes (`og:url`, `og:image`). Si el sitio se mueve al repositorio o dominio del cliente, hay que volver a generarlo con esa URL.

## Limitaciones

Es una "foto fija": los cambios en el CMS (Sanity) no se reflejan solos. Hay que volver a ejecutar los dos scripts y hacer commit.
