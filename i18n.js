// i18n.js: Módulo para gestionar la internacionalización

let translations = {};
const supportedLangs = ['es', 'ca', 'en', 'gl', 'eu'];
let renderCallback = () => {}; // Callback para re-renderizar la UI cuando cambia el idioma

/**
 * Carga el archivo de idioma JSON desde la carpeta /locales
 * @param {string} lang - El código del idioma a cargar (ej: 'es', 'en').
 */
async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) {
            throw new Error(`No se pudo cargar el archivo de idioma: ${lang}.json`);
        }
        translations = await response.json();
    } catch (error) {
        console.error('Error al cargar las traducciones:', error);
        // Si falla, se carga el español como idioma por defecto.
        if (lang !== 'es') {
            await loadTranslations('es');
        }
    }
}

/**
 * Traduce una clave de texto.
 * @param {string} key - La clave del texto a traducir (ej: 'nav_schedule').
 * @returns {string} - El texto traducido o la clave si no se encuentra.
 */
export function t(key) {
    return translations[key] || `[${key}]`; // Devuelve la clave para depurar si no hay traducción
}

/**
 * Cambia el idioma actual de la aplicación.
 * @param {string} lang - El nuevo idioma a establecer.
 */
async function setLanguage(lang) {
    // Asegurarse de que el idioma esté soportado
    if (!supportedLangs.includes(lang)) {
        lang = 'es';
    }
    
    await loadTranslations(lang);

    // Guardar la preferencia y actualizar la etiqueta lang y el título del documento
    document.documentElement.lang = lang;
    localStorage.setItem('preferredLanguage', lang);
    document.title = t('app_title');

    // Actualizar el estilo de los botones del selector de idioma
    document.querySelectorAll('.lang-switcher').forEach(btn => {
        const buttonLang = btn.dataset.lang;
        btn.classList.toggle('border-blue-600', buttonLang === lang);
        btn.classList.toggle('text-blue-600', buttonLang === lang);
        btn.classList.toggle('border-transparent', buttonLang !== lang);
        btn.classList.toggle('text-gray-500', buttonLang !== lang);
    });
    
    // Traducir los elementos estáticos (usando innerHTML para que renderice las etiquetas)
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.dataset.i18nKey;
        // *** CAMBIO CLAVE AQUÍ ***
        element.innerHTML = t(key);
    });

    // Llamar a la función render principal para que la vista activa se vuelva a generar con el nuevo idioma.
    renderCallback();
}

/**
 * Inicializa el sistema de internacionalización.
 * @param {function} renderFunc - La función principal de renderizado de la app.
 */
export async function initI18n(renderFunc) {
    renderCallback = renderFunc;

    // Detectar el idioma a cargar: 1º guardado, 2º del navegador, 3º español por defecto.
    const savedLang = localStorage.getItem('preferredLanguage');
    const browserLang = navigator.language.split('-')[0];
    const langToLoad = savedLang || (supportedLangs.includes(browserLang) ? browserLang : 'es');
    
    // Añadir los eventos de clic a los botones de idioma
    document.querySelectorAll('.lang-switcher').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedLang = e.currentTarget.dataset.lang;
            setLanguage(selectedLang);
        });
    });

    // Cargar el idioma inicial y actualizar la UI estática.
    await loadTranslations(langToLoad);
    document.documentElement.lang = langToLoad;
    document.title = t('app_title'); // Traduce el título al iniciar

    // Actualiza el estilo de los botones del selector de idioma al cargar
    document.querySelectorAll('.lang-switcher').forEach(btn => {
        const buttonLang = btn.dataset.lang;
        btn.classList.toggle('border-blue-600', buttonLang === langToLoad);
        btn.classList.toggle('text-blue-600', buttonLang === langToLoad);
        btn.classList.toggle('border-transparent', buttonLang !== langToLoad);
        btn.classList.toggle('text-gray-500', buttonLang !== langToLoad);
    });

    // Traduce los elementos estáticos al iniciar (usando innerHTML)
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        // *** CAMBIO CLAVE AQUÍ ***
        element.innerHTML = t(element.dataset.i18nKey);
    });
}
