(function () {
    const ANALYTICS_FALLBACK_ENDPOINT = 'https://bilateria.org/app/estadistica/diario/track.php';
    const ANALYTICS_COOLDOWN_MS = 30 * 60 * 1000;
    const ANALYTICS_TIMEOUT_MS = 4000;

    function getMetaContent(name) {
        const node = document.querySelector(`meta[name="${name}"]`);
        return node ? node.getAttribute('content') : '';
    }

    function getAnalyticsConfig() {
        return {
            endpoint: getMetaContent('analytics-endpoint') || ANALYTICS_FALLBACK_ENDPOINT,
            siteId: getMetaContent('analytics-site-id') || 'diario'
        };
    }

    function getStorageKey(siteId) {
        return `analytics:last-visit:${siteId}`;
    }

    function shouldCountVisit(siteId) {
        try {
            const rawValue = window.localStorage.getItem(getStorageKey(siteId));
            if (!rawValue) {
                return true;
            }
            const lastVisit = parseInt(rawValue, 10);
            if (!Number.isFinite(lastVisit)) {
                return true;
            }
            return (Date.now() - lastVisit) > ANALYTICS_COOLDOWN_MS;
        } catch (error) {
            return true;
        }
    }

    function rememberVisit(siteId) {
        try {
            window.localStorage.setItem(getStorageKey(siteId), String(Date.now()));
        } catch (error) {
            // Analytics must never block the app.
        }
    }

    function requestSummary(config) {
        const countVisit = shouldCountVisit(config.siteId);
        const callbackName = `diarioAnalyticsCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const query = new URLSearchParams();
        const script = document.createElement('script');
        let timeoutId = 0;
        let finished = false;

        query.set('callback', callbackName);
        if (!countVisit) {
            query.set('summary_only', '1');
        }

        function cleanup() {
            if (finished) {
                return;
            }
            finished = true;
            window.clearTimeout(timeoutId);
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            try {
                delete window[callbackName];
            } catch (error) {
                window[callbackName] = undefined;
            }
        }

        window[callbackName] = function (payload) {
            if (countVisit) {
                rememberVisit(config.siteId);
            }
            cleanup();
        };

        timeoutId = window.setTimeout(cleanup, ANALYTICS_TIMEOUT_MS);
        script.async = true;
        script.src = `${config.endpoint}?${query.toString()}`;
        script.onerror = cleanup;
        document.head.appendChild(script);
    }

    function initAnalytics() {
        const config = getAnalyticsConfig();
        const run = function () {
            requestSummary(config);
        };

        // Un <script async> inyectado antes de que se dispare «load» retrasa ese
        // evento hasta que la peticion termina. Si el servidor de estadisticas se
        // cuelga, «load» no llegaria a dispararse nunca. Por eso se espera siempre
        // a «load» antes de programar nada.
        const programar = function () {
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(run, { timeout: 2500 });
            } else {
                window.setTimeout(run, 1200);
            }
        };
        if (document.readyState === 'complete') {
            programar();
        } else {
            window.addEventListener('load', programar, { once: true });
        }
    }

    document.addEventListener('DOMContentLoaded', initAnalytics);
})();
