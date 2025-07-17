// manual_i18n.js: Inicializa la traducción para la página del manual.

import { initI18n } from './i18n.js';

// La función de renderizado para el manual es más simple,
// solo necesitamos que se ejecute una vez para traducir el contenido estático.
// initI18n se encargará de todo.
function renderManual() {
    // No es necesario hacer nada aquí porque initI18n
    // ya traduce los elementos con data-i18n-key.
    // También actualiza el título del documento.
    lucide.createIcons();
}

// Iniciar la internacionalización para la página del manual
initI18n(renderManual);
