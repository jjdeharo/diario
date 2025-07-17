// actions.js: Define toda la lógica de las acciones del usuario.

import { state, saveState, getRandomPastelColor } from './state.js';
import { showModal } from './utils.js';
import { t } from './i18n.js'; // Importamos la función de traducción

export const actionHandlers = {
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
    'export-student-docx': () => {
        const student = state.students.find(s => s.id === state.selectedStudentId);
        if (!student) return;

        const enrolledClasses = state.activities.filter(a => a.type === 'class' && a.studentIds?.includes(student.id));
        const studentAnnotations = Object.entries(state.classEntries)
            .map(([entryId, entryData]) => {
                const annotation = entryData.annotations?.[student.id];
                if (annotation && annotation.trim() !== '') {
                    const [activityId, date] = entryId.split('_');
                    const activity = state.activities.find(a => a.id === activityId);
                    return {
                        date,
                        activityName: activity ? activity.name : 'Clase eliminada',
                        annotation
                    };
                }
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        const doc = new docx.Document({
            sections: [{
                properties: {},
                children: [
                    new docx.Paragraph({
                        children: [
                            new docx.TextRun({
                                text: student.name,
                                bold: true,
                                size: 32,
                            }),
                        ],
                    }),
                    new docx.Paragraph({ text: "" }),
                    new docx.Paragraph({
                        children: [
                            new docx.TextRun({
                                text: t('enrolled_classes_title'),
                                bold: true,
                                size: 24,
                            }),
                        ],
                    }),
                    ...enrolledClasses.map(c => new docx.Paragraph({
                        text: c.name,
                        bullet: {
                            level: 0
                        }
                    })),
                     new docx.Paragraph({ text: "" }),
                    new docx.Paragraph({
                        children: [
                            new docx.TextRun({
                                text: t('general_notes_label'),
                                bold: true,
                                size: 24,
                            }),
                        ],
                    }),
                    new docx.Paragraph({
                        text: student.generalNotes || ''
                    }),
                    new docx.Paragraph({ text: "" }),
                    new docx.Paragraph({
                        children: [
                            new docx.TextRun({
                                text: t('session_notes_history_title'),
                                bold: true,
                                size: 24,
                            }),
                        ],
                    }),
                    ...studentAnnotations.flatMap(item => [
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: `${item.activityName} - ${new Date(item.date + 'T00:00:00').toLocaleDateString(document.documentElement.lang, { year: 'numeric', month: 'long', day: 'numeric' })}`,
                                    bold: true,
                                }),
                            ],
                        }),
                        new docx.Paragraph({
                            text: item.annotation,
                        }),
                        new docx.Paragraph({ text: "" }),
                    ])
                ],
            }],
        });

        docx.Packer.toBlob(doc).then(blob => {
            saveAs(blob, `informe-${student.name.replace(/ /g,"_")}.docx`);
        });
    },
    // --- Activity Actions ---
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
    'print-schedule': () => window.print(),
    'print-student-sheet': () => window.print(),
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
        }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cuaderno-profesor-backup-${new Date().toISOString().split('T')[0]}.json`;
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
};
