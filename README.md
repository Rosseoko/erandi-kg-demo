# Erandi · Revisión experta del sistema de conocimiento

Demo de solo lectura para revisar las tres capas de conocimiento de Erandi usando el caso **3° Básico · Ciencias Naturales · Abejas y polinización**.

## Abrir

Abrir `index.html` en un navegador moderno. No requiere build, servidor ni dependencias externas para visualizar los datos del grafo.

## Estructura

```text
index.html                 presentación / estructura
css/styles.css             estilos
js/app.js                  navegación, grafo, filtros y vistas
data/*.js                  datos cargados por la interfaz
data/csv/*.csv             CSV originales usados como fuente del demo
```

La separación `data / presentation` es intencional: la interfaz no contiene la ontología hardcodeada.

## Vistas

- **Grafo**: ruta Abejas resumida por defecto; presets para ruta completa, currículum, STEAM, pedagogía y todo el KG.
- **Marco STEAM**: cinco dominios, prácticas y progresiones. Las progresiones expertas se muestran como tales.
- **Inteligencia pedagógica**: movimientos, conexiones a OAH y STEAM, adaptación 3° Básico, DUA, evidencia y materiales.
- **Trayectoria PBL**: proyecto Abejas organizado en cuatro fases PBL con trazabilidad de cada sesión al grafo.
- **Fuentes**: procedencia y enlaces de referencia.

## Revisión experta

La aplicación es de solo lectura. Para reportar un cambio:

1. Seleccionar el nodo.
2. Abrir **Detalles** para ver definición, fuente, procedencia y relaciones.
3. Usar **Copiar ID**.
4. Referenciar ese ID en el comentario de revisión.

## Procedencia

El demo distingue visualmente:

- `official_curriculum`: contenido oficial de Mineduc.
- `external_framework`: marcos externos de referencia.
- `expert_synthesis` / `expert_interpretation` / `expert_application`: conocimiento añadido por síntesis o aplicación experta.
- `prototype`: material o estructura provisional de Erandi.

Una progresión experta puede estar en el KG y ser usada para razonar sin presentarse como progresión oficial del currículum.

## PBL

La trayectoria de demostración utiliza como referencia:

- PBLWorks — *The Project Path in TEACH*: cuatro fases de la trayectoria del proyecto.
- PBLWorks — *Gold Standard PBL: Essential Project Design Elements*: siete elementos de diseño del proyecto.

La plantilla es una adaptación para Erandi Aprende; no es una reproducción de una plantilla propietaria de PBLWorks.
