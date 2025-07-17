// privacy_i18n.js: Inicializa la traducción para la página de privacidad.

import { initI18n } from './i18n.js';

function renderPrivacyPage() {
    // initI18n se encarga de traducir los elementos con data-i18n-key
    // y de actualizar el título del documento si es necesario.
    lucide.createIcons();
}

// Iniciar la internacionalización para la página de privacidad.
initI18n(renderPrivacyPage);
