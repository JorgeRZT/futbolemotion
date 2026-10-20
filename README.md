# Fútbol Emotion · Edge Delivery Services + AEM Sites + Adobe Commerce (rama `da`)

Demo de la home de [futbolemotion.com](https://www.futbolemotion.com) migrada a **Experience Workspace (Edge Delivery Services + DA)**.

| Rama | Contenido | Preview |
|---|---|---|
| `main` | Migración de la landing con contenido en DA. **Congelada.** | https://main--futbolemotion--jorgerzt.aem.page/ |
| `aem` | Mismo código, más la composición y el contenido servidos desde AEM Sites (simulado), productos de Adobe Commerce y edición en Universal Editor | https://aem--futbolemotion--jorgerzt.aem.page/ |
| `edge` | Igual que `aem`, pero la página de AEM se renderiza con **AEM Edge Functions** en el CDN de Adobe | https://edge--futbolemotion--jorgerzt.aem.page/ |
| `da` | Igual que `aem`, pero el JSON de la página está **alojado en DA** (`/da-json-to-content/`) en lugar de en my-custom-api | https://da--futbolemotion--jorgerzt.aem.page/json-from-da |

> Demo con `noindex, nofollow`. Nada está publicado en `.aem.live`.

## Arquitectura

```
 AEM Sites (author, Universal Editor)          Adobe Commerce (Catalog Service)
   └─ modelo JSON de la página ──────┐          └─ productSearch ─┐
                                     ▼                            ▼
              Mock: my-custom-api (simula AEM + productos ya resueltos)
                                     │  JSON
                                     ▼
        json2html (edge de Adobe) + plantilla Mustache  →  HTML semántico de EDS
                                     │  (overlay del content source)
                                     ▼
          Edge Delivery Services: preview/publish → bloques EDS → navegador
```

- **Todo el render se hace en el servidor.** El navegador recibe el HTML con todo el contenido y los productos. No llama ni a AEM ni a Commerce.
- **DA sigue siendo la fuente principal.** El overlay solo responde en las rutas configuradas en json2html; el resto (home, `nav`, `footer`…) sigue saliendo de DA.
- **Edición:** Universal Editor sobre AEM Sites. Los mismos modelos sirven también para DA (`*.ue.da.live`).

## Qué contiene la rama `aem`

### 1. Página servida desde AEM + Commerce (json2html)
- **Página:** `/example-from-aem-and-commerce`.
- **Plantilla:** [`templates/aem-page.html`](templates/aem-page.html), en Mustache. Convierte el modelo JSON de la página en HTML de EDS: secciones, bloques, `section-metadata` y metadatos en el `<head>`.
- **Productos:** llegan ya resueltos en el JSON, como si AEM o App Builder hubiera consultado Catalog Service antes. Se renderizan como el bloque `cards products`.
- **Configuración de json2html** (org `jorgerzt`, site `futbolemotion`, rama `aem`):
  ```json
  [{
    "path": "/example-from-aem-and-commerce",
    "endpoint": "https://my-custom-api.lopezpellicerjorge.workers.dev/api/futbolemotion/aem/content/futbolemotion/es/{{id}}.model.json",
    "regex": "/[^/]+$/",
    "template": "/templates/aem-page.html"
  }]
  ```
- **Overlay** en el content source del sitio (Configuration Service):
  ```json
  "overlay": { "url": "https://json2html.adobeaem.workers.dev/jorgerzt/futbolemotion/aem", "type": "markup" }
  ```

### 2. Universal Editor
- **Modelos** en `ue/models/**`. `npm run build:json` los combina en `component-definition.json`, `component-models.json` y `component-filters.json`.
  - Cada definición incluye el plugin `da` (DA + UE) y el plugin `xwalk` (AEM Sites + UE).
  - **Variantes de bloque:** `cards` (products, players, recommender, categories, blog), `carousel` (hero), `columns` (banners).
  - **Estilos de sección:** full-width, centered, products, recommender, ratings, seo.
  - **Bloque `product-list`:** configuración clave-valor (category, sort, page-size, url-keys).
  - **Metadato de página `commerce-endpoint`.**
- `moveInstrumentation()` (en `scripts/scripts.js`) conserva los atributos `data-aue-*` y `data-richtext-*` cuando `cards` y `carousel` reconstruyen el DOM. Así los bloques siguen siendo editables en UE.

### 3. Bloque `product-list` (hueco para los drop-ins de Commerce)
- **Ficheros:** `blocks/product-list/`. Es un hueco que el autor coloca en AEM con su configuración. El bloque consulta `productSearch` de **Catalog Service**, la misma API que usan los drop-ins.
- **Endpoint:** lo toma del campo `endpoint` del bloque o, si no, del metadato `commerce-endpoint`.
- **Paso a producción:** sustituir `renderList()` por el contenedor de `@dropins/storefront-product-discovery`.
- **Ojo:** este bloque consulta Commerce **desde el navegador**. La página `/example-from-aem-and-commerce` no lo usa, porque allí los productos ya vienen renderizados desde el servidor.

### 4. Correcciones del build
- Se corrigen los errores de lint que venían de la plantilla:
  - se exporta `NX_ORIGIN`;
  - se ignoran los tests de `plugins/experimentation`;
  - stylelint: se desactiva `no-descending-specificity` y se unifica un selector duplicado en el footer.
- El workflow de CI pasa en verde.

## JSON alojado en DA (rama `da`)

En esta variante, el JSON de la página no viene de my-custom-api ni de AEM, sino de un **fichero `.json` alojado en Document Authoring**. El render sigue haciéndose en el servidor con json2html y la misma plantilla [`templates/aem-page.html`](templates/aem-page.html).

```
da.live/#/jorgerzt/futbolemotion/da-json-to-content/json-from-da.json
        │  admin.da.live/source/…  (Authorization reenviada desde el preview)
        ▼
json2html (overlay) + templates/aem-page.html  →  HTML de EDS
        │  preview
        ▼
https://da--futbolemotion--jorgerzt.aem.page/json-from-da
```

| | |
|---|---|
| Fichero en DA | [`/da-json-to-content/json-from-da.json`](https://da.live/#/jorgerzt/futbolemotion/da-json-to-content) |
| URL en EDS | https://da--futbolemotion--jorgerzt.aem.page/json-from-da |
| Formato del JSON | El mismo que el modelo de página de AEM (`metadata`, `sections[]`…). Ver *Contrato del JSON* más abajo |
| Render | json2html en el **preview**. El navegador no hace ninguna llamada a DA ni a ninguna API |

**Entrada añadida a la configuración de json2html:**
```json
{
  "path": "/json-from-da",
  "endpoint": "https://admin.da.live/source/jorgerzt/futbolemotion/da-json-to-content/{{id}}.json",
  "regex": "/[^/]+$/",
  "template": "/templates/aem-page.html",
  "forwardHeaders": ["Authorization"]
}
```

**Por qué funciona así:**
- **No se puede previsualizar el `.json` directamente en EDS.** EDS solo admite JSON con formato *sheet* (hojas de cálculo de DA); con uno anidado devuelve `invalid sheet; unknown type`.
- **`content.da.live` exige autenticación** (devuelve 401). Por eso json2html lee el fichero desde `admin.da.live/source/…` y reenvía la cabecera `Authorization` que la Admin API de EDS le pasa durante el preview (`forwardHeaders`). Así no se guarda ningún token en la configuración.
- **El overlay es común a todo el sitio** y apunta a la clave `/aem` de json2html. Por eso la entrada `/json-from-da` está registrada en la configuración `jorgerzt/futbolemotion/aem`, igual que `/example-from-aem-and-commerce`. Como el contenido es común a todas las ramas, la página también se ve en `aem--` y en `main--`.

**Cómo probarlo:**
1. Abre https://da--futbolemotion--jorgerzt.aem.page/json-from-da. El título es «JSON desde DA», hay 32 tarjetas y no se hace ninguna llamada a APIs desde el cliente.
2. Edita el JSON y súbelo de nuevo a DA. Puedes hacerlo desde da.live o con la API:
   ```bash
   curl -X PUT -H "Authorization: Bearer $IMS_TOKEN" \
     -F "data=@json-from-da.json;type=application/json" \
     https://admin.da.live/source/jorgerzt/futbolemotion/da-json-to-content/json-from-da.json
   ```
3. Lanza el preview **con tu sesión de Adobe**, desde el Sidekick o con la API. La credencial es la que json2html reenvía a DA:
   ```bash
   curl -X POST -H "Authorization: Bearer $IMS_TOKEN" \
     https://admin.hlx.page/preview/jorgerzt/futbolemotion/da/json-from-da
   ```
4. Recarga la página: el cambio aparece sin tocar el código.
5. **Para añadir otra página:**
   - sube `/da-json-to-content/<slug>.json`;
   - añade `{"path":"/<slug>", …}` a la configuración de json2html (POST del **array completo** a `…/config/jorgerzt/futbolemotion/aem`);
   - lanza el preview de `/<slug>`.

**Contrato del JSON:**
```jsonc
{
  "jcr:title": "…", "path": "…", "lastModified": "ISO-8601",
  "metadata": { "title": "…", "description": "…", "commerceEndpoint": "…" },
  "sections": [   // una clave por sección; el orden del array es el orden en la página
    { "carousel": { "slides": [ … ] } }, { "productList": { "products": [ … ] } },
    { "banners": { … } }, { "players": { … } }, { "recommender": { … } },
    { "categories": { … } }, { "blog": { … } }, { "ratings": { … } }, { "seo": { … } }
  ]
}
```

> **Limitación:** el preview necesita una sesión con acceso de lectura a DA. Un preview lanzado sin login, o un token que no sea de IMS, hace que json2html reciba un 401 de DA. Para producción conviene que el JSON se genere como *sheet* de DA (y usar `arrayKey`/`pathKey`) o servirlo desde un origen público.

## Endpoints simulados (my-custom-api)

Base: `https://my-custom-api.lopezpellicerjorge.workers.dev/api/futbolemotion/`

| Ruta | Simula |
|---|---|
| `aem/content/futbolemotion/es/example-from-aem-and-commerce.model.json` | Modelo JSON de la página en AEM, con los productos de Commerce resueltos. **Lo consume json2html.** |
| `aem/content/futbolemotion/es/home.model.json` | Modelo JSON de la home (el `product-list` es un hueco con su configuración) |
| `aem/author/content/futbolemotion/es/home.html` | HTML de AEM author instrumentado para Universal Editor (`data-aue-*`) |
| `aem/graphql/execute.json/futbolemotion/blog-posts` / `players` | Persisted queries de Content Fragments |
| `commerce/catalog-service/graphql` | Catalog Service `productSearch` (10 productos) |
| `byom/index.html`, `byom/nav.html`, `byom/footer.html` | Salida BYOM ya renderizada |
| `json2html/templates/home.html` | Copia de referencia de la plantilla Mustache |

Los generadores de estos mocks (Python + chevron) están fuera del repo, en el workspace de la oportunidad (`demos/aem-mocks/`).

## Cómo probarlo

### 1. Ver la página renderizada desde AEM + Commerce
Abre https://aem--futbolemotion--jorgerzt.aem.page/example-from-aem-and-commerce

Comprueba:
- **El HTML llega completo desde el servidor:**
  ```bash
  curl -s https://aem--futbolemotion--jorgerzt.aem.page/example-from-aem-and-commerce | grep -c '<h3'          # 32 tarjetas
  curl -s https://aem--futbolemotion--jorgerzt.aem.page/example-from-aem-and-commerce | grep 'name="source"'  # AEM Sites + Adobe Commerce
  ```
- **No hay llamadas desde el cliente:** en DevTools → Network no aparece ninguna petición a `workers.dev` ni a `graphql`.
- **El origen de la página es el overlay:**
  `https://admin.hlx.page/status/jorgerzt/futbolemotion/aem/example-from-aem-and-commerce` (con login) debe mostrar `sourceLocation: markup:https://json2html.adobeaem.workers.dev/...`. En la home, el `sourceLocation` sigue siendo DA.

### 2. Cambiar el contenido "en AEM" y verlo en EDS
1. Edita el JSON del endpoint `…/example-from-aem-and-commerce.model.json` en my-custom-api. Por ejemplo, cambia un título del carrusel o el precio de un producto.
2. Vuelve a lanzar el preview de la página. Puedes usar el Sidekick (**Preview**) o el Admin API:
   ```bash
   curl -X POST -H "Authorization: Bearer $IMS_TOKEN" \
     https://admin.hlx.page/preview/jorgerzt/futbolemotion/aem/example-from-aem-and-commerce
   ```
3. Recarga la página en `aem.page`: el cambio aparece sin desplegar código.

### 3. Probar json2html directamente
```bash
curl -H "Authorization: Bearer $IMS_TOKEN" \
  https://json2html.adobeaem.workers.dev/jorgerzt/futbolemotion/aem/example-from-aem-and-commerce
```
Una ruta no configurada devuelve 404, y entonces EDS sirve el contenido desde DA.

### 4. Añadir otra página desde AEM
1. Crea en my-custom-api el endpoint `aem/content/futbolemotion/es/<pagina>.model.json`, con la misma estructura.
2. Añade `/<pagina>` a la configuración de json2html:
   ```
   POST https://json2html.adobeaem.workers.dev/config/jorgerzt/futbolemotion/aem
   ```
   El cuerpo es el **array completo**, porque reemplaza la configuración anterior.
3. Lanza el preview de `/<pagina>`.

### 5. Universal Editor
- **Sobre DA, hoy:** `https://aem--futbolemotion--jorgerzt.ue.da.live/` (requiere UE habilitado en la org).
- **Sobre AEM Sites:** con un entorno author y la configuración xwalk, se usan los mismos `component-*.json` de esta rama.
- **Mock de author:** `…/aem/author/content/futbolemotion/es/home.html` muestra el marcado instrumentado que recibe UE.

### 6. Desarrollo local
```bash
npm i
npm run build:json   # regenera component-*.json tras tocar ue/models
npm run lint
aem up               # http://localhost:3000 (la página del overlay se sirve desde aem.page)
```

## Pendiente
- Conectar un entorno real de **AEM author** (xwalk) y sustituir el mock por el endpoint de AEM, añadiendo `forwardHeaders: ["Authorization"]` en json2html.
- Conectar un entorno real de **Adobe Commerce / Catalog Service** y activar los drop-ins en los bloques de producto.
- Mover la resolución de productos en el servidor a AEM o App Builder: hoy viene ya resuelta en el mock.
