// utils.js: Contiene funciones de ayuda reutilizables.

import { state } from './state.js';
import { t } from './i18n.js'; // Importamos la función de traducción

// Claves internas para los días de la semana. No dependen del idioma.
export const DAY_KEYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function darkenColor(hex, percent) {
    if (!hex || typeof hex !== 'string') return '#000000';
    let [r, g, b] = hex.match(/\w\w/g).map(x => parseInt(x, 16));
    const amount = Math.floor(255 * (percent / 100));
    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);
    return `#${[r,g,b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

export function getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

export function formatDate(date, options = { year: 'numeric', month: '2-digit', day: '2-digit' }) {
    return date.toLocaleDateString('sv-SE', options);
}

export function getWeekDateRange(date) {
    const startOfWeek = getWeekStartDate(date);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4);
    const options = { month: 'short', day: 'numeric' };
    const lang = document.documentElement.lang || 'es';

    // Formateamos las fechas
    let startStr = startOfWeek.toLocaleDateString(lang, options);
    let endStr = endOfWeek.toLocaleDateString(lang, {...options, year: 'numeric'});

    // Corrección específica para el euskera: eliminar el día de la semana entre paréntesis.
    if (lang === 'eu') {
        startStr = startStr.replace(/ \(.+\)/, '');
        endStr = endStr.replace(/ \(.+\)/, '');
    }

    return `${startStr} - ${endStr}`;
}

export function isSameDate(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// NUEVO: Devuelve el rango de fechas del trimestre seleccionado o null si es 'all'
export function getCurrentTermDateRange() {
    if (state.selectedTermId === 'all' || !state.terms) {
        return null;
    }
    const term = state.terms.find(t => t.id === state.selectedTermId);
    if (!term) return null;

    return {
        start: new Date(term.startDate + 'T00:00:00'),
        end: new Date(term.endDate + 'T23:59:59')
    };
}

// NUEVA FUNCIÓN: Comprueba si una fecha es festivo
export function isHoliday(date) {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    for (const holiday of state.holidays) {
        const startDate = new Date(holiday.startDate + 'T00:00:00');
        const endDate = new Date(holiday.endDate + 'T00:00:00');
        if (checkDate >= startDate && checkDate <= endDate) {
            return holiday;
        }
    }
    return null;
}


function findSession(activityId, fromDate, direction) {
    const timeSlots = state.timeSlots;
    const increment = direction === 'next' ? 1 : -1;
    const activity = state.activities.find(a => a.id === activityId);
    if (!activity) return null;

    let currentDate = new Date(fromDate);
    
    const termRange = getCurrentTermDateRange();

    for (let i = 0; i < 365; i++) {
        currentDate.setDate(currentDate.getDate() + increment);

        // Si hay un trimestre seleccionado, no buscar fuera de su rango
        if (termRange) {
            if (direction === 'next' && currentDate > termRange.end) return null;
            if (direction === 'previous' && currentDate < termRange.start) return null;
        }

        // No buscar en días festivos
        if (isHoliday(currentDate)) continue;

        const dayOfWeek = (currentDate.getDay() + 6) % 7; // Monday = 0
        
        if (dayOfWeek >= 0 && dayOfWeek < 5) { // Solo de Lunes a Viernes
            const dayKey = DAY_KEYS[dayOfWeek];
            const slotsToCheck = direction === 'next' ? timeSlots : [...timeSlots].reverse();

            for (const time of slotsToCheck) {
                if (state.schedule[`${dayKey}-${time.label}`] === activityId) {
                    const courseStartDate = state.courseStartDate ? new Date(state.courseStartDate + 'T00:00:00') : null;
                    const courseEndDate = state.courseEndDate ? new Date(state.courseEndDate + 'T23:59:59') : null;
                    const activityStartDate = activity.startDate ? new Date(activity.startDate + 'T00:00:00') : courseStartDate;
                    const activityEndDate = activity.endDate ? new Date(activity.endDate + 'T23:59:59') : courseEndDate;

                    let inDateRange = true;
                    if (courseStartDate && currentDate < courseStartDate) inDateRange = false;
                    if (courseEndDate && currentDate > courseEndDate) inDateRange = false;
                    if (activityStartDate && currentDate < activityStartDate) inDateRange = false;
                    if (activityEndDate && currentDate > activityEndDate) inDateRange = false;

                    if(inDateRange) {
                        return { day: dayKey, time: time.label, date: formatDate(currentDate) };
                    }
                }
            }
        }
    }
    return null;
}

export function findNextSession(activityId, fromDate) {
    return findSession(activityId, fromDate, 'next');
}

export function findPreviousSession(activityId, fromDate) {
    return findSession(activityId, fromDate, 'previous');
}

export function findNextClassSession(activityId) {
    const activity = state.activities.find(a => a.id === activityId);
    if (!activity) return null;

    let searchDate = new Date(state.currentDate);
    const termRange = getCurrentTermDateRange();
    if(termRange && searchDate < termRange.start) {
        searchDate = new Date(termRange.start);
    }

    for (let i = 0; i < 365; i++) {
        if(termRange && searchDate > termRange.end) return null;

        if (isHoliday(searchDate)) {
             searchDate.setDate(searchDate.getDate() + 1);
             continue;
        }

        const dayOfWeek = (searchDate.getDay() + 6) % 7;
        const dayKey = DAY_KEYS[dayOfWeek];

        if (dayOfWeek < 5) { // Monday to Friday
            for (const timeSlot of state.timeSlots) {
                const scheduleKey = `${dayKey}-${timeSlot.label}`;
                if (state.schedule[scheduleKey] === activityId) {
                    const courseStartDate = state.courseStartDate ? new Date(state.courseStartDate + 'T00:00:00') : null;
                    const courseEndDate = state.courseEndDate ? new Date(state.courseEndDate + 'T23:59:59') : null;
                    const activityStartDate = activity.startDate ? new Date(activity.startDate + 'T00:00:00') : courseStartDate;
                    const activityEndDate = activity.endDate ? new Date(activity.endDate + 'T23:59:59') : courseEndDate;

                    let inDateRange = true;
                    if (courseStartDate && searchDate < courseStartDate) inDateRange = false;
                    if (courseEndDate && searchDate > courseEndDate) inDateRange = false;
                    if (activityStartDate && searchDate < activityStartDate) inDateRange = false;
                    if (activityEndDate && searchDate > activityEndDate) inDateRange = false;
                    
                    if (inDateRange) {
                        return {
                            day: dayKey,
                            time: timeSlot.label,
                            date: formatDate(searchDate)
                        };
                    }
                }
            }
        }
        searchDate.setDate(searchDate.getDate() + 1);
    }
    return null; // No session found in the next year
}


export function showModal(title, content, onConfirm) {
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    modalTitle.textContent = title;
    modalBody.innerHTML = `<p>${content}</p>
        <div class="flex justify-end gap-4 mt-6">
            <button id="modal-cancel" class="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">${t('modal_cancel')}</button>
            <button id="modal-confirm" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">${t('modal_confirm')}</button>
        </div>`;
    
    const close = () => modalContainer.classList.add('hidden');
    modalContainer.classList.remove('hidden');
    
    document.getElementById('modal-confirm').onclick = () => {
        if(onConfirm) onConfirm();
        close();
    };
    document.getElementById('modal-cancel').onclick = close;
    modalCloseBtn.onclick = close;
}

export function showInfoModal(title, htmlContent, onClose) {
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    modalTitle.textContent = title;
    modalBody.innerHTML = `${htmlContent}
        <div class="flex justify-end gap-4 mt-6">
            <button id="modal-info-close" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">${t('modal_close')}</button>
        </div>`;
    
    const close = () => {
        modalContainer.classList.add('hidden');
        if (onClose) onClose();
    };

    modalContainer.classList.remove('hidden');
    
    document.getElementById('modal-info-close').onclick = close;
    modalCloseBtn.onclick = close;
}

export function getWeeksForCourse() {
    if (!state.courseStartDate || !state.courseEndDate) {
        return [];
    }

    const weeks = [];
    let currentDate = getWeekStartDate(new Date(state.courseStartDate + 'T12:00:00'));
    const endDate = new Date(state.courseEndDate + 'T12:00:00');
    const lang = document.documentElement.lang || 'es';

    while (currentDate <= endDate) {
        const startOfWeek = new Date(currentDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 4);
        
        const displayEndOfWeek = new Date(Math.min(endOfWeek, endDate));

        const options = { month: 'short', day: 'numeric' };
        const weekText = `${startOfWeek.toLocaleDateString(lang, options)} - ${displayEndOfWeek.toLocaleDateString(lang, {...options, year: 'numeric'})}`;
        
        weeks.push({
            date: formatDate(startOfWeek), // Formato YYYY-MM-DD
            text: weekText
        });

        currentDate.setDate(currentDate.getDate() + 7);
    }

    return weeks;
}
