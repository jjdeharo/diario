# 1. El diario no recoge estadísticas de uso

Fecha: 2026-10-30 · Estado: aceptado

## Contexto

Desde marzo de 2026 el diario enviaba las visitas a un contador propio en bilateria.org (`track.php`): cada carga hacía una petición JSONP, que contaba una visita como mucho cada 30 minutos por navegador. No enviaba los datos del diario (horarios, alumnado, anotaciones ni copias de seguridad), y un párrafo de la política de privacidad lo explicaba.

La evaluación con la rúbrica VCER de la guía «Vibe coding responsable» puntúa con 0 el punto de datos personales si el recurso lleva analítica, sea propia o ajena. Además, el diario guarda datos de alumnado menor, y que la aplicación no comunique nada sobre su uso es coherente con la promesa de que todo se queda en el navegador.

## Decisión

Se retira toda la analítica: el archivo `analytics.js`, su carga en `index.html` y las etiquetas `meta` `analytics-endpoint` y `analytics-site-id`. En los cinco idiomas, el párrafo de la política de privacidad que hablaba de las estadísticas dice ahora que la aplicación no las recoge, y se quitan los textos sin uso del antiguo contador del pie (`footer_analytics_visits` y `footer_analytics_today`).

## Alternativas descartadas

- **Mantener el contador propio con el aviso de privacidad.** Aunque no enviaba los datos del diario, seguía comunicando cada visita a un servidor, y la rúbrica VCER puntúa con 0 cualquier analítica.

## Consecuencias

- Ya no hay cifras de uso del diario.
- Los datos del contador en el alojamiento de IONOS (`/app/estadistica/diario/`) se archivan y se borran del servidor en una tarea aparte.
- Los navegadores que ya usaban el diario conservan la marca local `analytics:last-visit:diario`, que ya nada lee.
