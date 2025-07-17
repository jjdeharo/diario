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
    return `${startOfWeek.toLocaleDateString(lang, options)} - ${endOfWeek.toLocaleDateString(lang, {...options, year: 'numeric'})}`;
}

export function isSameDate(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function findSession(activityId, fromDate, direction) {
    const timeSlots = state.timeSlots;
    const increment = direction === 'next' ? 1 : -1;
    const activity = state.activities.find(a => a.id === activityId);
    if (!activity) return null;

    let currentDate = new Date(fromDate);
    currentDate.setDate(currentDate.getDate() + increment);

    for (let i = 0; i < 365; i++) {
        const dayOfWeek = (currentDate.getDay() + 6) % 7; // Monday = 0
        
        if (dayOfWeek >= 0 && dayOfWeek < 5) { // Solo de Lunes a Viernes
            const dayKey = DAY_KEYS[dayOfWeek]; // Usar la clave en inglés
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
        currentDate.setDate(currentDate.getDate() + increment);
    }
    return null;
}

export function findNextSession(activityId, fromDate) {
    return findSession(activityId, fromDate, 'next');
}

export function findPreviousSession(activityId, fromDate) {
    return findSession(activityId, fromDate, 'previous');
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
