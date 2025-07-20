// actions.js: Define toda la lógica de las acciones del usuario.

import { state, saveState, getRandomPastelColor } from './state.js';
import { showModal, showInfoModal, findNextClassSession, getCurrentTermDateRange } from './utils.js';
import { t } from './i18n.js';

function showImportSummary(data) {
    const title = t('import_summary_title');
    const content = `
        <ul class="list-disc list-inside space-y-2 text-left">
            <li><strong>${t('import_summary_activities')}:</strong> ${data.activities?.length || 0}</li>
            <li><strong>${t('import_summary_students')}:</strong> ${data.students?.length || 0}</li>
            <li><strong>${t('import_summary_timeslots')}:</strong> ${data.timeSlots?.length || 0}</li>
            <li><strong>${t('import_summary_entries')}:</strong> ${Object.keys(data.classEntries || {}).length}</li>
        </ul>
    `;
    showInfoModal(title, content, () => {
        window.location.reload();
    });
}

export const actionHandlers = {
    // --- Settings Tab Action ---
    'select-settings-tab': (id, element) => {
        const tabId = element.dataset.tabId;
        if (tabId) {
            state.settingsActiveTab = tabId;
            // No es necesario saveState() aquí, se guarda al renderizar
        }
    },

    // --- Load Example Action ---
    'load-example': () => {
        showModal(t('import_data_confirm_title'), t('import_data_confirm_text'), async () => {
            try {
                // --- INICIO DEL CÓDIGO MODIFICADO ---

                // 1. Obtener el idioma actual de la etiqueta <html lang="...">
                const lang = document.documentElement.lang || 'es';

                // 2. Construir la URL del archivo JSON para el idioma detectado.
                const url = `https://raw.githubusercontent.com/jjdeharo/gist/refs/heads/main/diario/demo/${lang}.json`;
                
                let response = await fetch(url);

                // 3. Si el archivo del idioma específico no se encuentra, intentar cargar el de español como alternativa.
                if (!response.ok) {
                    console.warn(`No se pudo cargar ${url}, se usará la versión en español.`);
                    response = await fetch('https://raw.githubusercontent.com/jjdeharo/gist/refs/heads/main/diario/demo/es.json');
                }

                // --- FIN DEL CÓDIGO MODIFICADO ---

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                state.activities = data.activities || [];
                state.students = data.students || [];
                state.timeSlots = data.timeSlots || [];
                state.schedule = data.schedule || {};
                state.scheduleOverrides = data.scheduleOverrides || [];
                state.classEntries = data.classEntries || {};
                state.courseStartDate = data.courseStartDate || '';
                state.courseEndDate = data.courseEndDate || '';
                state.terms = data.terms || [];
                saveState();
                showImportSummary(data);
            } catch (error) {
                console.error('Error loading example data:', error);
                alert(t('import_error_alert'));
            }
        });
    },

    'go-to-class-card': (id, element) => {
        const activityId = element.value;
        if (activityId) {
            const card = document.getElementById(`class-card-${activityId}`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.transition = 'outline 0.1s ease-in-out';
                card.style.outline = '3px solid #3b82f6';
                setTimeout(() => {
                    card.style.outline = 'none';
                }, 1500);
            }
        }
    },
    // --- Student Actions ---
    'add-student-to-class': (id, element) => {
        const activityId = element.dataset.activityId;
        const nameInput = document.getElementById(`new-student-name-${activityId}`);
        const name = nameInput.value.trim();
        if (!name) return;

        const activity = state.activities.find(a => a.id === activityId);
        if (!activity) return;

        let student = state.students.find(s => s.name.toLowerCase() === name.toLowerCase());

        if (!student) {
            student = { id: crypto.randomUUID(), name: name, generalNotes: '' };
            state.students.push(student);
        }
        
        if (!activity.studentIds?.includes(student.id)) {
            activity.studentIds = [...(activity.studentIds || []), student.id];
        }
        
        nameInput.value = '';
        saveState();
    },
    'add-selected-student-to-class': (id, element) => {
        const activityId = element.dataset.activityId;
        const activity = state.activities.find(a => a.id === activityId);
        const selectEl = document.getElementById(`add-student-select-${activityId}`);
        const studentId = selectEl.value;

        if (activity && studentId && !activity.studentIds?.includes(studentId)) {
            activity.studentIds.push(studentId);
            saveState();
        }
    },
    'remove-student-from-class': (id, element) => {
        const { activityId, studentId } = element.dataset;
        const activity = state.activities.find(a => a.id === activityId);
        if (activity) {
            activity.studentIds = activity.studentIds?.filter(sid => sid !== studentId);
            saveState();
        }
    },
    'select-student': (id, element) => {
        state.selectedStudentId = element.dataset.studentId;
        state.activeView = 'studentDetail';
    },
    'back-to-classes': () => {
        state.selectedStudentId = null;
        state.activeView = 'classes';
    },
    'edit-student-name': (id, element) => {
        const student = state.students.find(s => s.id === element.dataset.studentId);
        if(student) {
            student.name = element.value;
            saveState();
        }
    },
    'edit-student-notes': (id, element) => {
        const student = state.students.find(s => s.id === element.dataset.studentId);
        if(student) {
            student.generalNotes = element.value;
            saveState();
        }
    },
    'edit-session-annotation': (id, element) => {
        const { entryId, studentId } = element.dataset;
        if (state.classEntries[entryId] && state.classEntries[entryId].annotations) {
            state.classEntries[entryId].annotations[studentId] = element.value;
            saveState();
        }
    },
    'go-to-student': (id, element) => {
        const studentId = element.value;
        if (studentId) {
            const studentAnnotationEl = document.getElementById(`student-annotation-${studentId}`);
            if (studentAnnotationEl) {
                studentAnnotationEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    },
    'export-student-docx': () => {
        const student = state.students.find(s => s.id === state.selectedStudentId);
        if (!student) return;

        const enrolledClasses = state.activities.filter(a => a.type === 'class' && a.studentIds?.includes(student.id));
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
                    acc[activityId] = { name: activity ? activity.name : 'Clase eliminada', annotations: [] };
                }
                acc[activityId].annotations.push({ date, annotation });
            }
            return acc;
        }, {});

        Object.values(annotationsByClass).forEach(classData => classData.annotations.sort((a, b) => b.date - a.date));

        const doc = new docx.Document({
            sections: [{
                properties: {},
                children: [
                    new docx.Paragraph({
                        children: [ new docx.TextRun({ text: student.name, bold: true, size: 32 }) ],
                    }),
                    new docx.Paragraph({ text: "" }),
                    new docx.Paragraph({
                        children: [ new docx.TextRun({ text: t('enrolled_classes_title'), bold: true, size: 24 }) ],
                    }),
                    ...enrolledClasses.map(c => new docx.Paragraph({ text: c.name, bullet: { level: 0 } })),
                     new docx.Paragraph({ text: "" }),
                    new docx.Paragraph({
                        children: [ new docx.TextRun({ text: t('general_notes_label'), bold: true, size: 24 }) ],
                    }),
                    new docx.Paragraph({ text: student.generalNotes || '' }),
                    new docx.Paragraph({ text: "" }),
                    new docx.Paragraph({
                        children: [ new docx.TextRun({ text: t('session_notes_history_title'), bold: true, size: 24 }) ],
                    }),
                    ...Object.values(annotationsByClass).sort((a,b) => a.name.localeCompare(b.name)).flatMap(classData => [
                        new docx.Paragraph({ text: "" }),
                        new docx.Paragraph({
                            children: [ new docx.TextRun({ text: classData.name, bold: true, underline: true, size: 20 }) ],
                        }),
                        ...classData.annotations.flatMap(item => [
                           new docx.Paragraph({
                                children: [ new docx.TextRun({ text: item.date.toLocaleDateString(document.documentElement.lang, { year: 'numeric', month: 'long', day: 'numeric' }), italics: true, color: "888888" }) ],
                            }),
                            new docx.Paragraph({ text: item.annotation, indentation: { left: 400 } }),
                            new docx.Paragraph({ text: "" }),
                        ])
                    ])
                ],
            }],
        });

        docx.Packer.toBlob(doc).then(blob => {
            saveAs(blob, `informe-${student.name.replace(/ /g,"_")}.docx`);
        });
    },
    'print-student-sheet': () => {
        window.print();
    },
    // --- Activity Actions ---
    'go-to-class-session': (id, element) => {
        const activityId = element.dataset.activityId;
        const nextSession = findNextClassSession(activityId);
        if (nextSession) {
            const activityInfo = state.activities.find(a => a.id === activityId);
            state.selectedActivity = { ...activityInfo, ...nextSession };
            state.activeView = 'activityDetail';
        } else {
            alert('No hay clases programadas para esta asignatura en el futuro.');
        }
    },
    'add-activity': () => {
        const nameInput = document.getElementById('new-activity-name');
        const name = nameInput.value.trim();
        const type = document.querySelector('input[name="activityType"]:checked').value;
        if (name) {
            state.activities.push({ 
                id: crypto.randomUUID(), 
                name, 
                type, 
                studentIds: [],
                color: getRandomPastelColor(),
                startDate: state.courseStartDate,
                endDate: state.courseEndDate
            });
            nameInput.value = '';
            saveState();
        }
    },
    'delete-activity': (id) => {
        showModal(t('delete_activity_confirm_title'), t('delete_activity_confirm_text'), () => {
            state.activities = state.activities.filter(a => a.id !== id);
            saveState();
            document.dispatchEvent(new CustomEvent('render'));
        });
    },
    'edit-activity': (id) => {
        state.editingActivityId = id;
    },
    'cancel-edit-activity': () => {
        state.editingActivityId = null;
    },
    'save-activity': (id) => {
        const activity = state.activities.find(a => a.id === id);
        if (activity) {
            const nameInput = document.getElementById(`edit-activity-name-${id}`);
            const startDateInput = document.getElementById(`edit-activity-start-${id}`);
            const endDateInput = document.getElementById(`edit-activity-end-${id}`);
            
            const newName = nameInput.value.trim();
            if (newName) {
                activity.name = newName;
            }
            activity.startDate = startDateInput.value;
            activity.endDate = endDateInput.value;
            saveState();
        }
        state.editingActivityId = null;
    },
    'change-activity-color': (id, element) => {
         const activity = state.activities.find(a => a.id === id);
         if(activity) {
            activity.color = element.value;
            saveState();
            document.dispatchEvent(new CustomEvent('render'));
         }
    },
    // --- TimeSlot Actions ---
    'add-timeslot': () => {
        const labelInput = document.getElementById('new-timeslot-label');
        const label = labelInput.value.trim();
        if (label) {
            const newOrder = state.timeSlots.length > 0 ? Math.max(...state.timeSlots.map(t => t.order)) + 1 : 0;
            state.timeSlots.push({ id: crypto.randomUUID(), label, order: newOrder });
            labelInput.value = '';
            saveState();
        }
    },
    'delete-timeslot': (id) => {
        state.timeSlots = state.timeSlots.filter(t => t.id !== id);
        saveState();
    },
    'edit-timeslot': (id) => {
        state.editingTimeSlotId = id;
    },
    'cancel-edit-timeslot': () => {
        state.editingTimeSlotId = null;
    },
    'save-timeslot': (id) => {
        const timeSlot = state.timeSlots.find(t => t.id === id);
        if (timeSlot) {
            const input = document.querySelector(`input[data-action="edit-timeslot-input"]`);
            const oldLabel = timeSlot.label;
            const newLabel = input.value.trim();
            
            if (newLabel && oldLabel !== newLabel) {
                timeSlot.label = newLabel;
                Object.keys(state.schedule).forEach(key => {
                    if (key.endsWith(`-${oldLabel}`)) {
                        const day = key.split('-')[0];
                        const newKey = `${day}-${newLabel}`;
                        state.schedule[newKey] = state.schedule[key];
                        delete state.schedule[key];
                    }
                });
                saveState();
            }
        }
        state.editingTimeSlotId = null;
    },
    'reorder-timeslot': (id, element) => {
        const index = parseInt(element.dataset.index, 10);
        const direction = element.dataset.direction;
        const otherIndex = direction === 'up' ? index - 1 : index + 1;
        
        [state.timeSlots[index], state.timeSlots[otherIndex]] = [state.timeSlots[otherIndex], state.timeSlots[index]];
        
        saveState();
    },
    'generate-schedule-slots': () => {
        const startTimeStr = document.getElementById('gen-start-time').value;
        const endTimeStr = document.getElementById('gen-end-time').value;
        const classDuration = parseInt(document.getElementById('gen-class-duration').value, 10);
        const breakDuration = parseInt(document.getElementById('gen-break-duration').value, 10);
        const breakStartTimeStr = document.getElementById('gen-break-start').value;

        if (!startTimeStr || !endTimeStr || isNaN(classDuration)) {
            alert(t('generate_schedule_alert'));
            return;
        }

        const timeToMinutes = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
        const minutesToTime = (totalMinutes) => {
            const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
            const m = (totalMinutes % 60).toString().padStart(2, '0');
            return `${h}:${m}`;
        };

        const startMinutes = timeToMinutes(startTimeStr);
        const endMinutes = timeToMinutes(endTimeStr);
        const breakStartMinutes = breakStartTimeStr ? timeToMinutes(breakStartTimeStr) : -1;

        const newTimeSlots = [];
        let currentTime = startMinutes;
        
        while (currentTime < endMinutes) {
            if (breakDuration > 0 && breakStartMinutes !== -1 && currentTime >= breakStartMinutes && currentTime < (breakStartMinutes + breakDuration)) {
                const breakEndTime = breakStartMinutes + breakDuration;
                newTimeSlots.push({
                    id: crypto.randomUUID(),
                    label: `${minutesToTime(breakStartMinutes)}-${minutesToTime(breakEndTime)}`,
                });
                currentTime = breakEndTime;
                continue;
            }

            const classEndTime = currentTime + classDuration;
            if (classEndTime > endMinutes) break;
             newTimeSlots.push({
                id: crypto.randomUUID(),
                label: `${minutesToTime(currentTime)}-${minutesToTime(classEndTime)}`,
            });
            currentTime = classEndTime;
        }
        
        state.timeSlots = newTimeSlots;
        saveState();
    },
    // --- Schedule Actions ---
    'schedule-change': (id, element) => {
        const { day, time } = element.dataset;
        state.schedule[`${day}-${time}`] = element.value;
        saveState();
    },
    'add-schedule-override': () => {
        const day = document.getElementById('override-day').value;
        const time = document.getElementById('override-time').value;
        const activityId = document.getElementById('override-activity').value;
        const startDate = document.getElementById('override-start-date').value;
        const endDate = document.getElementById('override-end-date').value;

        if (!day || !time || !activityId || !startDate || !endDate) {
            alert(t('add_override_alert'));
            return;
        }
        
        state.scheduleOverrides.push({
            id: crypto.randomUUID(),
            day, time, activityId, startDate, endDate
        });
        saveState();
    },
    'delete-schedule-override': (id) => {
        state.scheduleOverrides = state.scheduleOverrides.filter(ov => ov.id !== id);
        saveState();
    },
    'print-schedule': () => {
        window.print();
    },
    'select-activity': (id, element) => {
        const { activityId, day, time, date } = element.dataset;
        const activityInfo = state.activities.find(a => a.id === activityId);
        state.selectedActivity = { ...activityInfo, day, time, date };
        state.activeView = 'activityDetail';
    },
    'back-to-schedule': () => {
        state.selectedActivity = null;
        state.activeView = 'schedule';
    },
    'navigate-to-session': (id, element) => {
        const { activityId, day, time, date } = element.dataset;
        const activityInfo = state.activities.find(a => a.id === activityId);
        state.selectedActivity = { ...activityInfo, day, time, date };
    },
    'prev-week': () => {
        state.currentDate.setDate(state.currentDate.getDate() - 7);
    },
    'next-week': () => {
        state.currentDate.setDate(state.currentDate.getDate() + 7);
    },
    'today': () => {
        state.currentDate = new Date();
    },
    'toggle-week-selector': () => {
        const menu = document.getElementById('week-selector-menu');
        const btn = document.getElementById('week-selector-btn');
        if (menu) {
            menu.classList.toggle('hidden');
            
            if (!menu.classList.contains('hidden')) {
                const closeHandler = (e) => {
                    if (!menu.contains(e.target) && !btn.contains(e.target)) {
                        menu.classList.add('hidden');
                        document.removeEventListener('click', closeHandler, true);
                    }
                };
                document.addEventListener('click', closeHandler, true);
            }
        }
    },
    'go-to-week': (id, element) => {
        const dateStr = element.dataset.date;
        if (dateStr) {
            state.currentDate = new Date(dateStr + 'T12:00:00');
            
            const menu = document.getElementById('week-selector-menu');
            if (menu) {
                menu.classList.add('hidden');
            }
        }
    },
    // --- Class Entry Actions ---
    'planned-change': (id, element) => {
        const entryId = `${state.selectedActivity.id}_${state.selectedActivity.date}`;
        if (!state.classEntries[entryId]) state.classEntries[entryId] = { annotations: {} };
        state.classEntries[entryId].planned = element.value;
        saveState();
    },
    'completed-change': (id, element) => {
        const entryId = `${state.selectedActivity.id}_${state.selectedActivity.date}`;
        if (!state.classEntries[entryId]) state.classEntries[entryId] = { annotations: {} };
        state.classEntries[entryId].completed = element.value;
        saveState();
    },
    'annotation-change': (id, element) => {
        const { studentId } = element.dataset;
        const entryId = `${state.selectedActivity.id}_${state.selectedActivity.date}`;
        if (!state.classEntries[entryId]) state.classEntries[entryId] = { annotations: {} };
        if (!state.classEntries[entryId].annotations) state.classEntries[entryId].annotations = {};
        state.classEntries[entryId].annotations[studentId] = element.value;
        saveState();
    },
    // --- Data Management Actions ---
    'update-course-date': (id, element) => {
        const type = element.dataset.type;
        if (type === 'start') {
            state.courseStartDate = element.value;
        } else {
            state.courseEndDate = element.value;
        }
        saveState();
    },
    'import-students': () => {
        const targetClassId = document.getElementById('import-target-class').value;
        const studentListTextEl = document.getElementById('student-list-text');
        const studentListText = studentListTextEl.value;
        const activity = state.activities.find(a => a.id === targetClassId);
        if (!activity || studentListText.trim() === '') {
            alert(t('import_students_alert'));
            return;
        }

        const names = studentListText.trim().split('\n').filter(name => name.trim() !== '');
        
        names.forEach(name => {
            const trimmedName = name.trim();
            if(!trimmedName) return;

            let student = state.students.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
            if (!student) {
                student = { id: crypto.randomUUID(), name: trimmedName, generalNotes: '' };
                state.students.push(student);
            }
            if (!activity.studentIds?.includes(student.id)) {
                activity.studentIds = [...(activity.studentIds || []), student.id];
            }
        });
        
        studentListTextEl.value = '';
        saveState();
    },
    'export-data': () => {
        const dataStr = JSON.stringify({
            activities: state.activities,
            students: state.students,
            timeSlots: state.timeSlots,
            schedule: state.schedule,
            scheduleOverrides: state.scheduleOverrides,
            classEntries: state.classEntries,
            courseStartDate: state.courseStartDate,
            courseEndDate: state.courseEndDate,
            terms: state.terms,
            selectedTermId: state.selectedTermId,
            holidays: state.holidays
        }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diario-clase-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },
    'import-data': (id, element, event) => {
        const file = event.target.files[0];
        if (!file) return;
        showModal(t('import_data_confirm_title'), t('import_data_confirm_text'), () => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    state.activities = data.activities || [];
                    state.students = data.students || [];
                    state.timeSlots = data.timeSlots || [];
                    state.schedule = data.schedule || {};
                    state.scheduleOverrides = data.scheduleOverrides || [];
                    state.classEntries = data.classEntries || {};
                    state.courseStartDate = data.courseStartDate || '';
                    state.courseEndDate = data.courseEndDate || '';
                    state.terms = data.terms || [];
                    state.selectedTermId = data.selectedTermId || 'all';
                    state.holidays = data.holidays || [];
                    saveState();
                    showImportSummary(data);
                } catch (error) {
                    alert(t('import_error_alert'));
                }
            };
            reader.readAsText(file);
        });
    },
    'import-schedule': (id, element, event) => {
        const file = event.target.files[0];
        if (!file) return;
        showModal(t('import_schedule_confirm_title'), t('import_schedule_confirm_text'), () => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    state.activities = data.activities || [];
                    state.timeSlots = data.timeSlots || [];
                    state.schedule = data.schedule || {};
                    state.scheduleOverrides = data.scheduleOverrides || [];
                    state.courseStartDate = data.courseStartDate || '';
                    state.courseEndDate = data.courseEndDate || '';
                    state.terms = data.terms || [];
                    
                    state.students = [];
                    state.classEntries = {};
                    
                    saveState();
                    alert(t('import_success_alert'));
                    window.location.reload();
                } catch (error) {
                    alert(t('import_error_alert'));
                }
            };
            reader.readAsText(file);
        });
    },
    'delete-all-data': () => {
        showModal(t('delete_all_data_confirm_title'), t('delete_all_data_confirm_text'), () => {
            localStorage.removeItem('teacherDashboardData');
            alert(t('delete_all_data_success_alert'));
            window.location.reload();
        });
    },
    'show-privacy-policy': () => {
        const title = t('privacy_title');
        const content = `
            <div class="prose prose-sm dark:prose-invert max-w-none text-left text-gray-700 dark:text-gray-300">
                <p>${t('privacy_p1')}</p>
                <p>${t('privacy_p2')}</p>
                <p>${t('privacy_p3')}</p>
                <p>${t('privacy_p4')}</p>
                <p>${t('privacy_p5')}</p>
            </div>
        `;
        showInfoModal(title, content);
    },
    'add-term': () => {
        const nameInput = document.getElementById('new-term-name');
        const startInput = document.getElementById('new-term-start');
        const endInput = document.getElementById('new-term-end');
        
        if (nameInput.value.trim() && startInput.value && endInput.value) {
            state.terms.push({
                id: crypto.randomUUID(),
                name: nameInput.value.trim(),
                startDate: startInput.value,
                endDate: endInput.value
            });
            nameInput.value = '';
            startInput.value = '';
            endInput.value = '';
            saveState();
        } else {
            alert(t('add_term_alert'));
        }
    },
    'delete-term': (id) => {
        state.terms = state.terms.filter(term => term.id !== id);
        if (state.selectedTermId === id) {
            state.selectedTermId = 'all';
        }
        saveState();
    },
    'add-holiday': () => {
        const nameInput = document.getElementById('new-holiday-name');
        const startInput = document.getElementById('new-holiday-start');
        const endInput = document.getElementById('new-holiday-end');

        if (nameInput.value.trim() && startInput.value) {
            state.holidays.push({
                id: crypto.randomUUID(),
                name: nameInput.value.trim(),
                startDate: startInput.value,
                endDate: endInput.value || startInput.value
            });
            nameInput.value = '';
            startInput.value = '';
            endInput.value = '';
            saveState();
        } else {
            alert(t('add_holiday_alert'));
        }
    },
    'delete-holiday': (id) => {
        state.holidays = state.holidays.filter(holiday => holiday.id !== id);
        saveState();
    },
    'select-term': (id, element) => {
        state.selectedTermId = element.value;
        saveState();
    }
};
