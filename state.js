// state.js: Gestiona el estado global y la persistencia de datos.

const pastelColors = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'];

// El estado central de la aplicación.
export const state = {
    activeView: 'schedule',
    activities: [],
    students: [],
    timeSlots: [],
    schedule: {},
    scheduleOverrides: [],
    classEntries: {},
    currentDate: new Date(),
    courseStartDate: '', // Mantenido por retrocompatibilidad, pero los trimestres tienen prioridad.
    courseEndDate: '',   // Mantenido por retrocompatibilidad.
    terms: [], // NUEVO: Array para guardar los trimestres.
    selectedTermId: 'all', // NUEVO: ID del trimestre seleccionado ('all' para ver todo).
    selectedActivity: null,
    selectedStudentId: null,
    editingTimeSlotId: null,
    editingActivityId: null,
};

export function getRandomPastelColor() {
    const usedColors = state.activities.map(a => a.color);
    const availableColors = pastelColors.filter(c => !usedColors.includes(c));
    return availableColors.length > 0 ? availableColors[0] : pastelColors[Math.floor(Math.random() * pastelColors.length)];
}

let saveTimeout;
export function saveState() {
    const dataToSave = {
        activities: state.activities,
        students: state.students,
        timeSlots: state.timeSlots,
        schedule: state.schedule,
        scheduleOverrides: state.scheduleOverrides,
        classEntries: state.classEntries,
        courseStartDate: state.courseStartDate,
        courseEndDate: state.courseEndDate,
        terms: state.terms, // Guardar los trimestres
        selectedTermId: state.selectedTermId, // Guardar la selección
    };
    localStorage.setItem('teacherDashboardData', JSON.stringify(dataToSave));
    
    const indicator = document.getElementById('save-indicator');
    if (indicator) {
        indicator.classList.add('show');
        lucide.createIcons({
            nodes: [indicator.querySelector('i')]
        });

        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            indicator.classList.remove('show');
        }, 1500);
    }
}

export function loadState() {
    const savedData = localStorage.getItem('teacherDashboardData');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        state.activities = parsedData.activities || [];
        state.students = parsedData.students || [];
        state.timeSlots = parsedData.timeSlots || [];
        state.schedule = parsedData.schedule || {};
        state.scheduleOverrides = parsedData.scheduleOverrides || [];
        state.classEntries = parsedData.classEntries || {};
        state.courseStartDate = parsedData.courseStartDate || '';
        state.courseEndDate = parsedData.courseEndDate || '';
        state.terms = parsedData.terms || []; // Cargar los trimestres
        state.selectedTermId = parsedData.selectedTermId || 'all'; // Cargar la selección
    }
}
