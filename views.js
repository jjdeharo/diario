// views.js: Contiene todas las funciones que generan el HTML de las vistas.

import { state } from './state.js';
import { darkenColor, getWeekStartDate, getWeekDateRange, formatDate, isSameDate, findNextSession, findPreviousSession, DAY_KEYS, findNextClassSession, getCurrentTermDateRange, getWeeksForCourse, isHoliday } from './utils.js';
import { t } from './i18n.js';

const sortStudentsByName = (studentA, studentB) => studentA.name.localeCompare(studentB.name);

function renderMobileHeaderActions(actions) {
    const container = document.getElementById('mobile-header-actions');
    if (!container) return;
    
    if (actions.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const buttonsHtml = actions.map(action => {
        if(action.action === 'import-data-mobile') {
            return `
                <label for="import-file-input-mobile" data-action="import-data-mobile" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 cursor-pointer">
                    <i data-lucide="${action.icon}" class="w-4 h-4"></i>
                    <span>${action.label}</span>
                </label>
                <input type="file" id="import-file-input-mobile" accept=".json" class="hidden"/>
            `;
        }
        return `<button data-action="${action.action}" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
            <i data-lucide="${action.icon}" class="w-4 h-4"></i>
            <span>${action.label}</span>
        </button>`
    }
    ).join('');

    container.innerHTML = `
        <button id="mobile-actions-menu-btn" class="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
            <i data-lucide="more-vertical" class="w-5 h-5"></i>
        </button>
        <div id="mobile-actions-menu" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-30 hidden border dark:border-gray-700">
            ${buttonsHtml}
        </div>
    `;
    lucide.createIcons();
    
    const mobileActionsBtn = document.getElementById('mobile-actions-menu-btn');
    const mobileActionsMenu = document.getElementById('mobile-actions-menu');

    if (mobileActionsBtn && mobileActionsMenu) {
        mobileActionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileActionsMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!mobileActionsMenu.contains(e.target) && !mobileActionsBtn.contains(e.target)) {
                mobileActionsMenu.classList.add('hidden');
            }
        });
    }
}

export function renderScheduleView() {
    const days = DAY_KEYS.map(dayKey => t(dayKey.toLowerCase()));
    const getActivityById = (id) => state.activities.find(c => c.id === id);
    const startOfWeek = getWeekStartDate(state.currentDate);
    const today = new Date();
    const termRange = getCurrentTermDateRange();

    renderMobileHeaderActions([
        { action: 'export-data', label: t('save_file'), icon: 'save' },
        { action: 'import-data-mobile', label: t('open_file'), icon: 'folder-open' },
        { action: 'print-schedule', label: t('print'), icon: 'printer' }
    ]);
    
    const headerCells = days.map((dayName, dayIndex) => {
        const cellDate = new Date(startOfWeek);
        cellDate.setDate(startOfWeek.getDate() + dayIndex);
        const isToday = isSameDate(cellDate, today);
        const formattedDate = cellDate.toLocaleDateString(document.documentElement.lang, { day: '2-digit', month: '2-digit' });
        return `<th class="p-2 border border-gray-200 dark:border-gray-700 ${isToday ? 'bg-blue-100 dark:bg-blue-900/50' : ''}">
                    <div class="hidden sm:block">${dayName}</div>
                    <div class="sm:hidden">${dayName.substring(0,3)}</div>
                    <div class="text-xs font-normal text-gray-500 dark:text-gray-400">${formattedDate}</div>
                </th>`;
    }).join('');

    const tableRows = state.timeSlots.map(time => {
        const cells = DAY_KEYS.map((dayKey, dayIndex) => {
            const cellDate = new Date(startOfWeek);
            cellDate.setDate(startOfWeek.getDate() + dayIndex);
            const formattedCellDate = formatDate(cellDate);
            const isToday = isSameDate(cellDate, today);

            const holiday = isHoliday(cellDate);
            if (holiday) {
                return `<td class="p-1 border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700">
                            <div class="p-2 h-full min-h-[40px] text-xs text-center text-gray-500 dark:text-gray-400 flex items-center justify-center">${holiday.name}</div>
                        </td>`;
            }

            let activityId = state.schedule[`${dayKey}-${time.label}`];

            const applicableOverride = state.scheduleOverrides.find(ov => {
                if (ov.day === dayKey && ov.time === time.label) {
                    const overrideStart = new Date(ov.startDate + 'T00:00:00');
                    const overrideEnd = new Date(ov.endDate + 'T23:59:59');
                    return cellDate >= overrideStart && cellDate <= overrideEnd;
                }
                return false;
            });

            if (applicableOverride) {
                activityId = applicableOverride.activityId;
            }
            
            const activityInfo = activityId ? getActivityById(activityId) : null;
            let cellContent = `<div class="p-2 h-full min-h-[40px]"></div>`;
            
            if (activityInfo) {
                const activityStartDate = activityInfo.startDate ? new Date(activityInfo.startDate + 'T00:00:00') : (termRange ? termRange.start : null);
                const activityEndDate = activityInfo.endDate ? new Date(activityInfo.endDate + 'T23:59:59') : (termRange ? termRange.end : null);

                let inDateRange = true;
                if(termRange) {
                    if (cellDate < termRange.start || cellDate > termRange.end) inDateRange = false;
                }
                if (activityStartDate && cellDate < activityStartDate) inDateRange = false;
                if (activityEndDate && cellDate > activityEndDate) inDateRange = false;

                if (inDateRange) {
                    const entryId = `${activityInfo.id}_${formattedCellDate}`;
                    const hasPlan = state.classEntries[entryId] && state.classEntries[entryId].planned;
                    const planIndicator = hasPlan ? `<span class="absolute top-1 right-1 text-xs">📝</span>` : '';

                    const style = `background-color: ${activityInfo.color}; color: ${darkenColor(activityInfo.color, 40)}; border: 1px solid ${darkenColor(activityInfo.color, 10)}`;
                    if (activityInfo.type === 'class') {
                        cellContent = `<button data-action="select-activity" data-activity-id='${activityInfo.id}' data-day='${dayKey}' data-time='${time.label}' data-date='${formattedCellDate}' class="relative w-full h-full p-2 rounded-md transition-colors text-sm font-semibold" style="${style}">${activityInfo.name}${planIndicator}</button>`;
                    } else {
                        cellContent = `<div class="w-full h-full p-2 rounded-md text-sm font-semibold flex items-center justify-center" style="${style}">${activityInfo.name}</div>`;
                    }
                }
            }
            return `<td class="p-1 border border-gray-200 dark:border-gray-700 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}">${cellContent}</td>`;
        }).join('');
        return `<tr><td class="p-2 border border-gray-200 dark:border-gray-700 font-mono bg-gray-50 dark:bg-gray-800 text-sm">${time.label}</td>${cells}</tr>`;
    }).join('');
    
    const formatDateForDisplay = (dateStr) => {
        if (!dateStr) return '';
        const dateObj = new Date(dateStr + 'T00:00:00');
        return dateObj.toLocaleDateString(document.documentElement.lang, { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    let allTermsDateRange = '';
    if (state.courseStartDate && state.courseEndDate) {
        const start = formatDateForDisplay(state.courseStartDate);
        const end = formatDateForDisplay(state.courseEndDate);
        allTermsDateRange = ` (${start} - ${end})`;
    }
    const allTermsOption = `<option value="all" ${state.selectedTermId === 'all' ? 'selected' : ''}>${t('view_all_terms')}${allTermsDateRange}</option>`;

    const termOptions = state.terms.map(term => {
        const start = formatDateForDisplay(term.startDate);
        const end = formatDateForDisplay(term.endDate);
        const dateRange = ` (${start} - ${end})`;
        return `<option value="${term.id}" ${state.selectedTermId === term.id ? 'selected' : ''}>${term.name}${dateRange}</option>`;
    }).join('');

    const courseWeeks = getWeeksForCourse();
    const weeksListHtml = courseWeeks.length > 0
        ? courseWeeks.map(week =>
            `<button
                data-action="go-to-week"
                data-date="${week.date}"
                class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >${week.text}</button>`
        ).join('')
        : `<div class="px-4 py-2 text-sm text-gray-500">${t('course_dates_not_set')}</div>`;

    return `
        <div class="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/50 min-h-full">
            <div class="hidden sm:flex justify-between items-center mb-6 no-print">
                 <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200">${t('schedule_view_title')}</h2>
                 <div class="flex items-center gap-2">
                    <button data-action="export-data" class="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 flex items-center gap-2">
                        <i data-lucide="save" class="w-5 h-5"></i> <span>${t('save_file')}</span>
                    </button>
                    <label class="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 flex items-center gap-2 cursor-pointer">
                        <i data-lucide="folder-open" class="w-5 h-5"></i> <span>${t('open_file')}</span>
                        <input type="file" id="import-file-input" accept=".json" class="hidden"/>
                    </label>
                    <button data-action="print-schedule" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2">
                        <i data-lucide="printer" class="w-5 h-5"></i> ${t('print')}
                    </button>
                 </div>
            </div>
             <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-4">
                    <button data-action="prev-week" class="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><i data-lucide="chevron-left"></i></button>
                    <div class="relative">
                        <button id="week-selector-btn" data-action="toggle-week-selector" class="font-semibold text-center text-lg p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                            ${getWeekDateRange(state.currentDate)}
                        </button>
                        <div id="week-selector-menu" class="absolute left-1/2 -translate-x-1/2 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-30 hidden border dark:border-gray-700 max-h-80 overflow-y-auto">
                            ${weeksListHtml}
                        </div>
                    </div>
                    <button data-action="next-week" class="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><i data-lucide="chevron-right"></i></button>
                </div>
                <div class="flex items-center gap-2">
                    <select data-action="select-term" class="p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm">
                        ${allTermsOption}
                        ${termOptions}
                    </select>
                    <button data-action="today" class="bg-gray-600 text-white px-3 py-2 text-sm rounded-md hover:bg-gray-700">${t('today')}</button>
                </div>
            </div>
            <div id="printable-schedule" class="printable-area">
                <h2 class="text-2xl font-bold text-gray-800 mb-6 hidden print:block text-center">${t('schedule_view_title')} - ${getWeekDateRange(state.currentDate)}</h2>
                <div class="bg-white dark:bg-gray-800 p-0 sm:p-4 rounded-lg shadow-md overflow-x-auto">
                    <table class="w-full border-collapse text-center">
                        <thead><tr class="bg-gray-100 dark:bg-gray-900"><th class="p-2 border border-gray-200 dark:border-gray-700 w-24">${t('hour')}</th>${headerCells}</tr></thead>
                        <tbody>${tableRows.length > 0 ? tableRows : `<tr><td colspan="6" class="p-4 text-gray-500 dark:text-gray-400">${t('add_timeslots_in_settings')}</td></tr>`}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

export function renderClassesView() {
    renderMobileHeaderActions([]);
    const classes = state.activities.filter(a => a.type === 'class').sort((a, b) => a.name.localeCompare(b.name));
    
    if (classes.length === 0) {
        return `<div class="p-4 sm:p-6"><h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">${t('classes_view_title')}</h2><p class="text-gray-500 dark:text-gray-400">${t('no_classes_created')}</p></div>`;
    }

    const selectOptions = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const classesHtml = classes.map(c => {
        const studentsOfClass = state.students
            .filter(s => c.studentIds?.includes(s.id))
            .sort(sortStudentsByName);
        
        const studentsHtml = studentsOfClass.map(s => `
            <div class="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                <button data-action="select-student" data-student-id="${s.id}" class="text-left font-medium text-blue-600 dark:text-blue-400 hover:underline flex-grow">${s.name}</button>
                <button data-action="remove-student-from-class" data-activity-id="${c.id}" data-student-id="${s.id}" class="text-red-500 hover:text-red-700 ml-4 flex-shrink-0"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
        `).join('');

        const formattedStartDate = c.startDate ? new Date(c.startDate + 'T00:00:00').toLocaleDateString(document.documentElement.lang) : 'N/A';
        const formattedEndDate = c.endDate ? new Date(c.endDate + 'T00:00:00').toLocaleDateString(document.documentElement.lang) : 'N/A';

        return `
        <div id="class-card-${c.id}" class="bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col">
            <button data-action="go-to-class-session" data-activity-id="${c.id}" class="p-4 text-left w-full bg-gray-50 dark:bg-gray-700/50 rounded-t-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <h3 class="text-xl font-bold" style="color: ${darkenColor(c.color, 40)}">${c.name}</h3>
                <div class="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                    <div class="flex items-center gap-2">
                        <i data-lucide="users" class="w-4 h-4"></i>
                        <span>${c.studentIds?.length || 0} ${t('students_in_this_class')}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <i data-lucide="calendar" class="w-4 h-4"></i>
                        <span>${formattedStartDate} - ${formattedEndDate}</span>
                    </div>
                </div>
            </button>
            <div class="p-4 flex-grow">
                <div class="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    ${studentsHtml || `<p class="text-sm text-gray-500 dark:text-gray-400">${t('no_students_in_class')}</p>`}
                </div>
                <div class="flex flex-col sm:flex-row gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <input type="text" id="new-student-name-${c.id}" placeholder="${t('add_student_placeholder')}" class="flex-grow p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                    <button data-action="add-student-to-class" data-activity-id="${c.id}" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex-shrink-0 flex items-center justify-center gap-2"><i data-lucide="plus" class="w-5 h-5 sm:hidden"></i><span class="hidden sm:inline">${t('add')}</span></button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    return `
        <div class="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/50 min-h-full">
            <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200">${t('classes_view_title')}</h2>
                <div class="flex-shrink-0 w-full sm:w-64">
                    <label for="class-quick-nav" class="sr-only">${t('quick_nav_to_class')}</label>
                    <select id="class-quick-nav" data-action="go-to-class-card" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm">
                        <option value="">${t('quick_nav_to_class')}</option>
                        ${selectOptions}
                    </select>
                </div>
            </div>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${classesHtml}
            </div>
        </div>
    `;
}

export function renderStudentDetailView() {
    renderMobileHeaderActions([
        { action: 'export-student-docx', label: t('export_to_docx'), icon: 'file-text' },
        { action: 'print-student-sheet', label: t('print'), icon: 'printer' },
        { action: 'back-to-classes', label: t('back'), icon: 'arrow-left' },
    ]);

    const student = state.students.find(s => s.id === state.selectedStudentId);
    if (!student) {
        return `<div class="p-6"><p class="text-red-500">${t('student_not_found')}</p><button data-action="back-to-classes">${t('back')}</button></div>`;
    }

    const termRange = getCurrentTermDateRange();
    
    const annotationsByClass = Object.entries(state.classEntries).reduce((acc, [entryId, entryData]) => {
        const annotation = entryData.annotations?.[student.id];
        if (annotation && annotation.trim() !== '') {
            const [activityId, dateString] = entryId.split('_');
            const date = new Date(dateString + 'T00:00:00');

            if (termRange && (date < termRange.start || date > termRange.end)) {
                return acc;
            }

            const activity = state.activities.find(a => a.id === activityId);
            if (!acc[activityId]) {
                acc[activityId] = {
                    name: activity ? activity.name : 'Clase eliminada',
                    color: activity ? activity.color : '#cccccc',
                    annotations: []
                };
            }
            acc[activityId].annotations.push({ entryId, date, annotation });
        }
        return acc;
    }, {});

    for (const activityId in annotationsByClass) {
        annotationsByClass[activityId].annotations.sort((a, b) => b.date - a.date);
    }
    
    const annotationClasses = Object.entries(annotationsByClass).sort(([, a], [, b]) => a.name.localeCompare(b.name));

    const classSelectorOptions = annotationClasses.map(([activityId, classData]) =>
        `<option value="${activityId}">${classData.name}</option>`
    ).join('');

    const classSelectorHtml = annotationClasses.length > 0 ? `
        <div class="mb-4 no-print">
            <label for="annotation-class-nav" class="block text-sm font-medium text-gray-700 dark:text-gray-300">${t('quick_nav_to_class')}</label>
            <select id="annotation-class-nav"
                    onchange="if(this.value) { document.getElementById('annotation-block-' + this.value).scrollIntoView({ behavior: 'smooth', block: 'start' }); }"
                    class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">-- ${t('choose_a_class')} --</option>
                ${classSelectorOptions}
            </select>
        </div>
    ` : '';
    
    const annotationsHistoryHtml = annotationClasses.length > 0
        ? annotationClasses.map(([activityId, classData]) => `
            <div id="annotation-block-${activityId}" class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
                <h4 class="flex items-center gap-2 mb-3 text-md font-semibold">
                    <span class="w-4 h-4 rounded-full" style="background-color: ${classData.color};"></span>
                    <span>${classData.name}</span>
                </h4>
                <div class="space-y-3 pl-6 border-l-2 border-gray-200 dark:border-gray-600">
                ${classData.annotations.map(item => `
                    <div class="relative">
                         <span class="absolute -left-[31px] top-1 h-4 w-4 rounded-full bg-gray-300 dark:bg-gray-500 border-4 border-gray-50 dark:border-gray-700/50"></span>
                         <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">${item.date.toLocaleDateString(document.documentElement.lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                         <textarea data-action="edit-session-annotation" data-entry-id="${item.entryId}" data-student-id="${student.id}" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 h-24">${item.annotation}</textarea>
                    </div>
                `).join('')}
                </div>
            </div>
        `).join('')
        : `<p class="text-gray-500 dark:text-gray-400">${t('no_session_notes')}</p>`;

    return `
        <div class="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/50 min-h-full">
            <div class="hidden sm:flex justify-between items-center mb-6 no-print">
                <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200">${t('student_detail_view_title')}</h2>
                <div class="flex items-center gap-2">
                     <button data-action="export-student-docx" class="bg-blue-800 text-white px-4 py-2 rounded-md hover:bg-blue-900 flex items-center gap-2">
                        <i data-lucide="file-text"></i> ${t('export_to_docx')}
                    </button>
                     <button data-action="print-student-sheet" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2">
                        <i data-lucide="printer"></i> ${t('print')}
                    </button>
                    <button data-action="back-to-classes" class="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2">
                        <i data-lucide="arrow-left"></i> ${t('back')}
                    </button>
                </div>
            </div>
            <div id="student-sheet-content" class="printable-area bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md max-w-4xl mx-auto">
                <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 print:block hidden">${student.name}</h2>
                <div class="space-y-6">
                    <div>
                        <label for="edit-student-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">${t('student_name_label')}</label>
                        <input type="text" id="edit-student-name" data-action="edit-student-name" data-student-id="${student.id}" value="${student.name}" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                    </div>

                    <div>
                        <label for="edit-student-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300">${t('general_notes_label')}</label>
                        <textarea id="edit-student-notes" data-action="edit-student-notes" data-student-id="${student.id}" placeholder="${t('general_notes_placeholder')}" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 h-32">${student.generalNotes || ''}</textarea>
                    </div>
                    <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-200 mb-3">${t('session_notes_history_title')}</h3>
                        ${classSelectorHtml}
                        <div class="space-y-4 pr-2">${annotationsHistoryHtml}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function renderSettingsView() {
    renderMobileHeaderActions([]);
    
    const tabs = [
        { id: 'calendar', labelKey: 'settings_tab_calendar', icon: 'calendar-days' },
        { id: 'schedule', labelKey: 'settings_tab_schedule', icon: 'clock' },
        { id: 'activities', labelKey: 'settings_tab_activities', icon: 'users' },
        { id: 'data', labelKey: 'settings_tab_data', icon: 'database' }
    ];

    const tabButtonsHtml = tabs.map(tab => {
        const isActive = state.settingsActiveTab === tab.id;
        return `
            <button 
                data-action="select-settings-tab" 
                data-tab-id="${tab.id}" 
                class="flex-1 sm:flex-initial sm:flex-grow-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
                ${isActive ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
            >
                <i data-lucide="${tab.icon}" class="w-5 h-5"></i>
                <span class="hidden sm:inline">${t(tab.labelKey)}</span>
            </button>
        `;
    }).join('');

    // --- Calendar Tab Content ---
    const termsHtml = state.terms.map(term => `
        <div class="p-3 border border-gray-200 dark:border-gray-600 rounded-md">
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-semibold">${term.name}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(term.startDate+'T00:00:00').toLocaleDateString(document.documentElement.lang)} - ${new Date(term.endDate+'T00:00:00').toLocaleDateString(document.documentElement.lang)}</p>
                </div>
                <button data-action="delete-term" data-id="${term.id}" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>
        </div>
    `).join('');

    const holidaysHtml = state.holidays.map(holiday => `
        <div class="p-3 border border-gray-200 dark:border-gray-600 rounded-md flex justify-between items-center">
            <div>
                <p class="font-semibold">${holiday.name}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    ${new Date(holiday.startDate + 'T00:00:00').toLocaleDateString(document.documentElement.lang)}
                    ${holiday.endDate !== holiday.startDate ? ' - ' + new Date(holiday.endDate + 'T00:00:00').toLocaleDateString(document.documentElement.lang) : ''}
                </p>
            </div>
            <button data-action="delete-holiday" data-id="${holiday.id}" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
        </div>
    `).join('');

    const calendarTabContent = `
        <div class="grid lg:grid-cols-2 gap-8 items-start">
            <div class="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 class="text-lg font-semibold mb-3">${t('course_dates_title')}</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">${t('start_date')}</label>
                        <input type="date" data-action="update-course-date" data-type="start" value="${state.courseStartDate}" class="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">${t('end_date')}</label>
                        <input type="date" data-action="update-course-date" data-type="end" value="${state.courseEndDate}" class="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                    </div>
                </div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 class="text-lg font-semibold mb-3">${t('terms_management_title')}</h3>
                <div class="space-y-4 p-4 border border-dashed dark:border-gray-600 rounded-md">
                    <input type="text" id="new-term-name" placeholder="${t('term_name_placeholder')}" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">${t('start_date')}</label>
                            <input type="date" id="new-term-start" class="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">${t('end_date')}</label>
                            <input type="date" id="new-term-end" class="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                        </div>
                    </div>
                    <button data-action="add-term" class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center gap-2"><i data-lucide="plus" class="w-5 h-5"></i>${t('add_term')}</button>
                </div>
                <div class="space-y-3 mt-4">${termsHtml}</div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 class="text-lg font-semibold mb-3">${t('holidays_management_title')}</h3>
                <div class="space-y-4 p-4 border border-dashed dark:border-gray-600 rounded-md">
                    <input type="text" id="new-holiday-name" placeholder="${t('holiday_name_placeholder')}" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">${t('start_date')}</label>
                            <input type="date" id="new-holiday-start" class="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">${t('end_date_optional')}</label>
                            <input type="date" id="new-holiday-end" class="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                        </div>
                    </div>
                    <button data-action="add-holiday" class="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center justify-center gap-2"><i data-lucide="plus" class="w-5 h-5"></i>${t('add_holiday')}</button>
                </div>
                <div class="space-y-3 mt-4">${holidaysHtml}</div>
            </div>
        </div>
    `;

    // --- Schedule Tab Content ---
    const timeSlotsHtml = state.timeSlots.map((slot, index) => {
        if (state.editingTimeSlotId === slot.id) {
            return `
            <div class="flex justify-between items-center bg-white dark:bg-gray-700 p-2 rounded-md border border-blue-500">
                <input type="text" data-action="edit-timeslot-input" value="${slot.label}" class="flex-grow p-1 border-0 bg-transparent rounded-md focus:ring-0">
                <div class="flex items-center gap-2">
                    <button data-action="save-timeslot" data-id="${slot.id}" class="text-green-600 hover:text-green-800"><i data-lucide="check" class="w-5 h-5"></i></button>
                    <button data-action="cancel-edit-timeslot" class="text-red-600 hover:text-red-800"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>
            </div>`;
        }
        return `
            <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
                <span class="flex-grow cursor-pointer" data-action="edit-timeslot" data-id="${slot.id}">${slot.label}</span>
                <div class="flex items-center gap-2">
                    <button data-action="reorder-timeslot" data-index="${index}" data-direction="up" ${index === 0 ? 'disabled' : ''} class="disabled:opacity-25 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"><i data-lucide="chevron-up" class="w-5 h-5"></i></button>
                    <button data-action="reorder-timeslot" data-index="${index}" data-direction="down" ${index === state.timeSlots.length - 1 ? 'disabled' : ''} class="disabled:opacity-25 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"><i data-lucide="chevron-down" class="w-5 h-5"></i></button>
                    <button data-action="delete-timeslot" data-id="${slot.id}" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>`;
    }).join('');
    
    const scheduleTableRows = state.timeSlots.map(time => {
        const cells = DAY_KEYS.map(day => `
            <td class="p-1 border border-gray-200 dark:border-gray-700">
                <select data-action="schedule-change" data-day="${day}" data-time="${time.label}" class="w-full p-1 border-0 rounded-md focus:ring-1 focus:ring-blue-500 text-xs bg-white dark:bg-gray-700">
                    <option value="">${t('free')}</option>
                    ${state.activities.map(act => `<option value="${act.id}" ${state.schedule[`${day}-${time.label}`] === act.id ? 'selected' : ''}>${act.name}</option>`).join('')}
                </select>
            </td>
        `).join('');
        return `<tr><td class="p-2 border border-gray-200 dark:border-gray-700 font-mono bg-gray-50 dark:bg-gray-800">${time.label}</td>${cells}</tr>`;
    }).join('');
    
    const scheduleOverridesHtml = state.scheduleOverrides.map(ov => {
        const activity = state.activities.find(a => a.id === ov.activityId);
        return `
            <div class="text-sm p-2 bg-gray-100 dark:bg-gray-700 rounded-md flex justify-between items-center">
                <div>
                    <span class="font-semibold">${t(ov.day.toLowerCase())} ${ov.time}</span> <i data-lucide="arrow-right" class="inline-block w-4 h-4"></i> <span class="font-semibold">${activity ? activity.name : 'Clase eliminada'}</span>
                    <div class="text-xs text-gray-600 dark:text-gray-400">${ov.startDate} a ${ov.endDate}</div>
                </div>
                <button data-action="delete-schedule-override" data-id="${ov.id}" class="text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        `
    }).join('');

    const scheduleTabContent = `
        <div class="grid lg:grid-cols-2 gap-8 items-start">
            <div class="space-y-8">
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h3 class="text-lg font-semibold mb-3 flex items-center gap-2"><i data-lucide="wand-2" class="w-5 h-5"></i> ${t('schedule_generator_title')}</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="block text-sm font-medium">${t('start_time')}</label><input type="time" id="gen-start-time" value="08:00" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"></div>
                        <div><label class="block text-sm font-medium">${t('end_time')}</label><input type="time" id="gen-end-time" value="17:00" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"></div>
                        <div><label class="block text-sm font-medium">${t('class_duration_min')}</label><input type="number" id="gen-class-duration" value="60" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"></div>
                        <div><label class="block text-sm font-medium">${t('break_duration_min')}</label><input type="number" id="gen-break-duration" value="30" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"></div>
                        <div class="col-span-2"><label class="block text-sm font-medium">${t('break_start_time_optional')}</label><input type="time" id="gen-break-start" value="11:00" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"></div>
                    </div>
                    <button data-action="generate-schedule-slots" class="mt-4 w-full bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 flex items-center justify-center gap-2">${t('generate_slots')}</button>
                </div>
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h3 class="text-lg font-semibold mb-3 flex items-center gap-2"><i data-lucide="clock" class="w-5 h-5"></i> ${t('timeslots_management_title')}</h3>
                    <div class="flex gap-2 mb-4">
                        <input type="text" id="new-timeslot-label" placeholder="${t('timeslot_placeholder')}" class="flex-grow p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                        <button data-action="add-timeslot" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"><i data-lucide="plus-circle" class="w-5 h-5"></i>${t('add')}</button>
                    </div>
                    <div class="space-y-2">${timeSlotsHtml}</div>
                </div>
            </div>
            <div class="space-y-8">
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h3 class="text-lg font-semibold mb-3">${t('weekly_schedule_config_title')}</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full border-collapse text-sm">
                            <thead><tr class="bg-gray-100 dark:bg-gray-900"><th class="p-2 border border-gray-200 dark:border-gray-700">${t('hour')}</th>${DAY_KEYS.map(day => `<th class="p-2 border border-gray-200 dark:border-gray-700">${t(day.toLowerCase())}</th>`).join('')}</tr></thead>
                            <tbody>${scheduleTableRows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h3 class="text-lg font-semibold mb-3">${t('schedule_overrides_title')}</h3>
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div><label class="block text-sm font-medium">${t('day')}</label><select id="override-day" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">${DAY_KEYS.map(day => `<option value="${day}">${t(day.toLowerCase())}</option>`).join('')}</select></div>
                            <div><label class="block text-sm font-medium">${t('timeslot')}</label><select id="override-time" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">${state.timeSlots.map(t => `<option>${t.label}</option>`).join('')}</select></div>
                        </div>
                        <div><label class="block text-sm font-medium">${t('replace_with')}</label><select id="override-activity" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">${state.activities.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select></div>
                        <div class="grid grid-cols-2 gap-4">
                            <div><label class="block text-sm font-medium">${t('from_date')}</label><input type="date" id="override-start-date" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"></div>
                            <div><label class="block text-sm font-medium">${t('until_date')}</label><input type="date" id="override-end-date" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"></div>
                        </div>
                        <button data-action="add-schedule-override" class="w-full bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600">${t('add_override')}</button>
                    </div>
                    <div class="mt-6 space-y-2">${scheduleOverridesHtml}</div>
                </div>
            </div>
        </div>
    `;

    // --- Activities Tab Content ---
    const activitiesHtml = state.activities.map(act => {
        let studentsInClassHtml = '';
        if (act.type === 'class') {
            const enrolledStudents = state.students
                .filter(s => act.studentIds?.includes(s.id))
                .sort(sortStudentsByName);
            
            const enrolledStudentsHtml = enrolledStudents.map(student => `
                <div class="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded-md text-sm">
                    <button data-action="select-student" data-student-id="${student.id}" class="text-left font-medium text-blue-600 dark:text-blue-400 hover:underline flex-grow">${student.name}</button>
                    <button data-action="remove-student-from-class" data-activity-id="${act.id}" data-student-id="${student.id}" class="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
            `).join('');

            const availableStudents = state.students
                .filter(s => !act.studentIds?.includes(s.id))
                .sort(sortStudentsByName);
                
            const availableStudentsOptions = availableStudents.map(student => `<option value="${student.id}">${student.name}</option>`).join('');

            studentsInClassHtml = `
                <div class="mt-3 space-y-3">
                    <div>
                        <h4 class="text-sm font-medium mb-2">${t('students_in_this_class')}</h4>
                        <div class="space-y-2">
                            ${enrolledStudents.length > 0 ? enrolledStudentsHtml : `<p class="text-xs text-gray-500 dark:text-gray-400">${t('no_students_assigned_short')}</p>`}
                        </div>
                    </div>
                    <div class="border-t border-gray-200 dark:border-gray-700 pt-3">
                        <h4 class="text-sm font-medium mb-2">${t('add_existing_student')}</h4>
                        <div class="flex gap-2">
                            <select id="add-student-select-${act.id}" class="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700">
                                <option value="">${t('select_student')}</option>
                                ${availableStudentsOptions}
                            </select>
                            <button data-action="add-selected-student-to-class" data-activity-id="${act.id}" class="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 flex-shrink-0"><i data-lucide="plus" class="w-5 h-5"></i></button>
                        </div>
                    </div>
                </div>
            `;
        }

        if (state.editingActivityId === act.id) {
            return `
            <div id="edit-activity-form-${act.id}" class="p-4 border rounded-md bg-white dark:bg-gray-700 border-blue-500">
                <div class="flex justify-between items-center">
                    <input type="color" data-action="change-activity-color" data-id="${act.id}" value="${act.color}" class="p-0 border-none rounded-full cursor-pointer w-7 h-7">
                    <input type="text" id="edit-activity-name-${act.id}" value="${act.name}" class="flex-grow p-1 mx-2 border-0 bg-transparent rounded-md focus:ring-0 font-semibold">
                    <div class="flex items-center gap-2">
                        <button data-action="save-activity" data-id="${act.id}" class="text-green-600 hover:text-green-800"><i data-lucide="check" class="w-5 h-5"></i></button>
                        <button data-action="cancel-edit-activity" class="text-red-600 hover:text-red-800"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                </div>
                <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <label class="block font-medium text-gray-600 dark:text-gray-300">${t('start_date')}</label>
                        <input type="date" id="edit-activity-start-${act.id}" value="${act.startDate || ''}" class="w-full p-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md">
                    </div>
                    <div>
                        <label class="block font-medium text-gray-600 dark:text-gray-300">${t('end_date')}</label>
                        <input type="date" id="edit-activity-end-${act.id}" value="${act.endDate || ''}" class="w-full p-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md">
                    </div>
                </div>
                ${studentsInClassHtml}
            </div>`;
        }
        return `
        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2 flex-grow">
                   <input type="color" data-action="change-activity-color" data-id="${act.id}" value="${act.color}" class="p-0 border-none rounded-full cursor-pointer w-7 h-7">
                   <span class="font-semibold cursor-pointer" data-action="edit-activity" data-id="${act.id}">${act.name} <span class="text-xs text-gray-500 dark:text-gray-400 font-normal">(${act.type === 'class' ? t('class') : t('general')})</span></span>
                </div>
                <button data-action="delete-activity" data-id="${act.id}" class="text-red-500 hover:text-red-700 ml-2"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>
            ${studentsInClassHtml}
        </div>`;
    }).join('');
    
    const activitiesTabContent = `
        <div class="grid lg:grid-cols-2 gap-8 items-start">
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 class="text-lg font-semibold mb-3">${t('activities_management_title')}</h3>
                <div class="flex gap-2 mb-2">
                    <input type="text" id="new-activity-name" placeholder="${t('activity_name_placeholder')}" class="flex-grow p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                    <button data-action="add-activity" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"><i data-lucide="plus-circle" class="w-5 h-5"></i>${t('add')}</button>
                </div>
                <div class="flex gap-4 mb-4 text-sm">
                    <label class="flex items-center gap-2"><input type="radio" name="activityType" value="class" checked class="form-radio text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>${t('activity_type_class')}</label>
                    <label class="flex items-center gap-2"><input type="radio" name="activityType" value="general" class="form-radio text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>${t('activity_type_general')}</label>
                </div>
                <div class="space-y-3 max-h-96 overflow-y-auto pr-2">${activitiesHtml}</div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 class="text-lg font-semibold mb-3 flex items-center gap-2"><i data-lucide="clipboard-paste" class="w-5 h-5"></i> ${t('quick_import_title')}</h3>
                <div class="space-y-4">
                    <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">${t('step1_select_class')}</label><select id="import-target-class" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"><option value="">${t('choose_a_class')}</option>${state.activities.filter(a => a.type === 'class').map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                    <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">${t('step2_paste_list')}</label><textarea id="student-list-text" placeholder="Juan Pérez\nMaría García\n..." class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md h-32"></textarea></div>
                    <button data-action="import-students" class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center justify-center gap-2"><i data-lucide="upload" class="w-5 h-5"></i> ${t('import_students')}</button>
                </div>
            </div>
        </div>
    `;

    // --- Data Tab Content ---
    const dataTabContent = `
        <div class="max-w-xl mx-auto">
            <div class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 rounded-r-lg">
                <h3 class="text-lg font-semibold text-red-800 dark:text-red-300 flex items-center gap-2"><i data-lucide="alert-triangle" class="w-5 h-5"></i> ${t('danger_zone_title')}</h3>
                <div class="mt-4 space-y-2">
                    <label class="w-full bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 flex items-center justify-center gap-2 cursor-pointer">
                        <i data-lucide="file-import" class="w-5 h-5"></i>
                        <span>${t('import_schedule')}</span>
                        <input type="file" id="import-schedule-input" accept=".json" class="hidden"/>
                    </label>
                    <button data-action="delete-all-data" class="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center justify-center gap-2"><i data-lucide="trash-2" class="w-5 h-5"></i> ${t('delete_all_data')}</button>
                </div>
            </div>
        </div>
    `;

    let activeTabContent = '';
    switch (state.settingsActiveTab) {
        case 'calendar': activeTabContent = calendarTabContent; break;
        case 'schedule': activeTabContent = scheduleTabContent; break;
        case 'activities': activeTabContent = activitiesTabContent; break;
        case 'data': activeTabContent = dataTabContent; break;
        default: activeTabContent = calendarTabContent;
    }

    return `
        <div class="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/50 min-h-full space-y-6">
            <h2 class="hidden sm:block text-2xl font-bold text-gray-800 dark:text-gray-200">${t('settings_view_title')}</h2>
            
            <div class="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm flex flex-wrap gap-2">
                ${tabButtonsHtml}
            </div>

            <div id="settings-tab-content">
                ${activeTabContent}
            </div>
        </div>
    `;
}

export function renderActivityDetailView() {
    renderMobileHeaderActions([
        { action: 'back-to-schedule', label: t('back_to_schedule'), icon: 'arrow-left' }
    ]);

    const { name, day, time, date, id: activityId } = state.selectedActivity;
    const entryId = `${activityId}_${date}`;
    const entry = state.classEntries[entryId] || { planned: '', completed: '', annotations: {} };
    const studentsInClass = state.students
        .filter(s => state.selectedActivity.studentIds?.includes(s.id))
        .sort(sortStudentsByName);

    const annotationsHtml = studentsInClass.length > 0 ? studentsInClass.map(student => `
        <div id="student-annotation-${student.id}" key="${student.id}">
            <button data-action="select-student" data-student-id="${student.id}" class="text-left font-medium text-blue-600 dark:text-blue-400 hover:underline w-full">${student.name}</button>
            <textarea data-action="annotation-change" data-student-id="${student.id}" placeholder="${t('student_notes_placeholder')}" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md mt-1 h-24">${entry.annotations?.[student.id] || ''}</textarea>
        </div>
    `).join('') : `<p class="text-gray-500 dark:text-gray-400">${t('no_students_assigned')}</p>`;
    
    const prevSession = findPreviousSession(activityId, new Date(date));
    const nextSession = findNextSession(activityId, new Date(date));

    const prevButton = prevSession ? `<button data-action="navigate-to-session" data-activity-id="${activityId}" data-day="${prevSession.day}" data-time="${prevSession.time}" data-date="${prevSession.date}" class="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"><i data-lucide="arrow-left"></i> ${t('previous_session')}</button>` : `<button class="bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 px-4 py-2 rounded-md cursor-not-allowed flex items-center gap-2" disabled><i data-lucide="arrow-left"></i> ${t('previous_session')}</button>`;
    const nextButton = nextSession ? `<button data-action="navigate-to-session" data-activity-id="${activityId}" data-day="${nextSession.day}" data-time="${nextSession.time}" data-date="${nextSession.date}" class="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2">${t('next_session')} <i data-lucide="arrow-right"></i></button>` : `<button class="bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 px-4 py-2 rounded-md cursor-not-allowed flex items-center gap-2" disabled>${t('next_session')} <i data-lucide="arrow-right"></i></button>`;


    return `
        <div class="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/50 min-h-full">
            <div class="hidden sm:flex justify-between items-center mb-2">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200">${name}</h2>
                    <p class="text-gray-500 dark:text-gray-400">${t(day.toLowerCase())}, ${new Date(date + 'T00:00:00').toLocaleDateString(document.documentElement.lang, {day: 'numeric', month: 'long', year: 'numeric'})} (${time})</p>
                </div>
                <button data-action="back-to-schedule" class="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">${t('back_to_schedule')}</button>
            </div>
             <p class="sm:hidden text-gray-500 dark:text-gray-400 mb-4">${t(day.toLowerCase())}, ${new Date(date + 'T00:00:00').toLocaleDateString(document.documentElement.lang, {day: 'numeric', month: 'long', year: 'numeric'})} (${time})</p>
            <div class="flex justify-between items-center mb-6">
                ${prevButton}
                ${nextButton}
            </div>
            <div class="grid md:grid-cols-2 gap-6">
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
                    <div><label class="block text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">${t('planning_for_today')}</label><textarea data-action="planned-change" placeholder="${t('planning_placeholder')}" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md h-32">${entry.planned || ''}</textarea></div>
                    <div><label class="block text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">${t('summary_of_session')}</label><textarea data-action="completed-change" placeholder="${t('summary_placeholder')}" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md h-32">${entry.completed || ''}</textarea></div>
                </div>
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h3 class="text-lg font-semibold mb-3">${t('student_annotations_title')}</h3>
                    <div class="mb-4">
                        <label for="student-quick-nav" class="sr-only">${t('select_student')}</label>
                        <select id="student-quick-nav" data-action="go-to-student" class="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                            <option value="">-- ${t('select_student')} --</option>
                            ${studentsInClass.map(student => `<option value="${student.id}">${student.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-4 max-h-96 overflow-y-auto pr-2">${annotationsHtml}</div>
                </div>
            </div>
        </div>
    `;
}
