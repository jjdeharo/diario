// main.js: El punto de entrada principal que une todo.

import { state, loadState } from './state.js';
import * as views from './views.js';
import { actionHandlers } from './actions.js';
import { initI18n, t } from './i18n.js';

const mainContent = document.getElementById('main-content');
const navButtons = document.querySelectorAll('.nav-button');
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const mobileHeaderTitle = document.getElementById('mobile-header-title');
const themeSwitcherBtns = document.querySelectorAll('.theme-switcher');

function render() {
    mainContent.innerHTML = '';
    let viewContent = '';

    switch (state.activeView) {
        case 'schedule': viewContent = views.renderScheduleView(); break;
        case 'classes': viewContent = views.renderClassesView(); break;
        case 'settings': viewContent = views.renderSettingsView(); break;
        case 'activityDetail': viewContent = views.renderActivityDetailView(); break;
        case 'studentDetail': viewContent = views.renderStudentDetailView(); break;
        default: viewContent = views.renderScheduleView();
    }
    mainContent.innerHTML = `<div class="animate-fade-in">${viewContent}</div>`;
    
    updateMobileHeader();
    lucide.createIcons();
    attachEventListeners();
}

function updateMobileHeader() {
    const keyMap = {
        schedule: 'schedule_view_title',
        classes: 'classes_view_title',
        settings: 'settings_view_title',
        activityDetail: 'activity_detail_view_title',
        studentDetail: 'student_detail_view_title'
    };
    mobileHeaderTitle.textContent = t(keyMap[state.activeView] || 'app_title');
}

function updateNavButtons() {
    navButtons.forEach(btn => {
        const view = btn.dataset.view;
        const isActive = view === state.activeView;
        btn.classList.toggle('bg-blue-600', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('text-gray-600', !isActive);
        btn.classList.toggle('dark:text-gray-300', !isActive);
        btn.classList.toggle('hover:bg-gray-200', !isActive);
        btn.classList.toggle('dark:hover:bg-gray-700', !isActive);
    });
}


function handleAction(action, element, event) {
    const id = element.dataset.id;
    const reRenderActions = [
        'add-activity', 'delete-activity', 'add-student-to-class', 'remove-student-from-class',
        'add-timeslot', 'delete-timeslot', 'reorder-timeslot', 'import-students',
        'select-activity', 'back-to-schedule', 'generate-schedule-slots', 'edit-timeslot',
        'save-timeslot', 'cancel-edit-timeslot', 'edit-activity', 'save-activity',
        'cancel-edit-activity', 'prev-week', 'next-week', 'today', 'select-student', 'back-to-classes',
        'add-selected-student-to-class', 'navigate-to-session', 'add-schedule-override', 'delete-schedule-override',
        'go-to-class-session', 'add-term', 'delete-term', 'select-term', 'go-to-week',
        'add-holiday', 'delete-holiday', 'select-settings-tab' // FIX: Added action to re-render
    ];
    
    if (actionHandlers[action]) {
        actionHandlers[action](id, element, event);
    }

    if (reRenderActions.includes(action)) {
        render();
        if (action === 'edit-activity') {
            const targetElement = document.getElementById(`edit-activity-form-${id}`);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
}

function attachEventListeners() {
    const elements = document.querySelectorAll('[data-action]');
    elements.forEach(el => {
        const action = el.dataset.action;
        const eventType = ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ? 'input' : 'click';
        
        if (el.dataset.listenerAttached === 'true') return;
        
        if (action === 'import-data-mobile') return;

        const listener = (e) => {
             if (el.closest('.nav-button')) {
                toggleSidebar(false);
            }
            handleAction(action, el, e)
        };

        el.addEventListener(eventType, listener);
        el.dataset.listenerAttached = 'true';
    });
    
    const importInput = document.getElementById('import-file-input');
    if (importInput && importInput.dataset.listenerAttached !== 'true') {
        importInput.addEventListener('change', (e) => handleAction('import-data', importInput, e));
        importInput.dataset.listenerAttached = 'true';
    }
    
    const mobileImportInput = document.getElementById('import-file-input-mobile');
    if (mobileImportInput && mobileImportInput.dataset.listenerAttached !== 'true') {
        mobileImportInput.addEventListener('change', (e) => handleAction('import-data', mobileImportInput, e));
        mobileImportInput.dataset.listenerAttached = 'true';
    }

    const importScheduleInput = document.getElementById('import-schedule-input');
    if (importScheduleInput && importScheduleInput.dataset.listenerAttached !== 'true') {
        importScheduleInput.addEventListener('change', (e) => handleAction('import-schedule', importScheduleInput, e));
        importScheduleInput.dataset.listenerAttached = 'true';
    }
}


function toggleSidebar(show) {
    if (show) {
        sidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    }
}

function setTheme(theme) {
    if (theme === 'system') {
        localStorage.removeItem('theme');
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    } else {
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
    updateThemeSwitcherUI(theme);
}

function updateThemeSwitcherUI(theme) {
     themeSwitcherBtns.forEach(btn => {
        const btnTheme = btn.dataset.theme;
        const isActive = btnTheme === theme;
        btn.classList.toggle('bg-blue-600', isActive);
        btn.classList.toggle('text-white', isActive);
         btn.classList.toggle('text-gray-500', !isActive);
        btn.classList.toggle('dark:text-gray-400', !isActive);
    });
}


async function init() {
    const savedTheme = localStorage.getItem('theme') || 'system';
    setTheme(savedTheme);

    await initI18n(() => {
        render();
        updateNavButtons();
    }); 
    
    loadState();
    render();
    updateNavButtons();
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeView = btn.dataset.view;
            state.selectedActivity = null;
            state.selectedStudentId = null;
            updateNavButtons();
            render();
            if (window.innerWidth < 640) {
                toggleSidebar(false);
            }
        });
    });
    
    openSidebarBtn.addEventListener('click', () => toggleSidebar(true));
    closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
    sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
    
    themeSwitcherBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.theme);
        });
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (localStorage.getItem('theme') === 'system') {
            setTheme('system');
        }
    });

    document.addEventListener('render', () => render());
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 640) {
            sidebar.classList.remove('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
        }
    });
}

init();
