// profile.js (исправленная версия)

// ─── Применяем тему сразу, до рендера DOM (избегаем flash of white) ──────────
(function () {
    try {
        var isDark = localStorage.getItem('qf_setting_theme') === '1';
        var isA11y = localStorage.getItem('qf_setting_a11y') === '1';
        document.documentElement.classList.toggle('qf-theme-alt', isDark);
        document.documentElement.classList.toggle('qf-a11y', isA11y);
    } catch (e) { /* localStorage недоступен — молча игнорируем */ }
})();

// Обновляем тему при изменении настроек в соседней вкладке / родительском окне
window.addEventListener('storage', function (e) {
    if (e.key === 'qf_setting_theme') {
        document.documentElement.classList.toggle('qf-theme-alt', e.newValue === '1');
    }
    if (e.key === 'qf_setting_a11y') {
        document.documentElement.classList.toggle('qf-a11y', e.newValue === '1');
    }
});

// State management
const AVATAR_OPTIONS_STUDENT = [
    { id: 'standard', type: 'image', url: '/icons/Standard_avatar.png', label: 'По умолчанию' },
    { id: 'boy',      type: 'image', url: '/icons/Boy_avatar.png',      label: 'Мальчик' },
    { id: 'girl',     type: 'image', url: '/icons/Girl_avatar.png',     label: 'Девочка' },
];

const AVATAR_OPTIONS_TEACHER = [
    { id: 'standard', type: 'image', url: '/icons/Standard_avatar.png', label: 'По умолчанию' },
    { id: 'men',      type: 'image', url: '/icons/Men_avatar.png',      label: 'Мужской' },
    { id: 'women',    type: 'image', url: '/icons/Women_avatar.png',    label: 'Женский' },
];

let state = {
    profile: null,
    role: null,
    availableTests: [],
    teacherTests: [],
    loading: true,
    testsLoading: false,
    error: null,
    profileNotFound: false,
    selectedAvatar: null,
    avatarOptions: AVATAR_OPTIONS_STUDENT,
    // Active cosmetics (populated when INVENTORY_LOADED arrives)
    activeFrame:  null,
    activeColor:  null,
    activePrefix: null,
    inventory:    null,
};

// DOM Elements
const elements = {
    // States
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    profileNotFound: document.getElementById('profileNotFound'),
    mainContent: document.getElementById('mainContent'),

    // Error elements
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    retryBtn: document.getElementById('retryBtn'),
    logoutErrorBtn: document.getElementById('logoutErrorBtn'),

    // Profile not found elements
    recreateProfileBtn: document.getElementById('recreateProfileBtn'),
    logoutNotFoundBtn: document.getElementById('logoutNotFoundBtn'),

    // Avatar elements
    avatarContainer: document.getElementById('avatarContainer'),
    userAvatar: document.getElementById('userAvatar'),
    avatarModal: document.getElementById('avatarModal'),
    avatarOptions: document.getElementById('avatarOptions'),
    avatarUrlInput: document.getElementById('avatarUrlInput'),
    useUrlBtn: document.getElementById('useUrlBtn'),
    cancelAvatarBtn: document.getElementById('cancelAvatarBtn'),
    saveAvatarBtn: document.getElementById('saveAvatarBtn'),

    // Main content elements
    userName: document.getElementById('userName'),
    userEmail: document.getElementById('userEmail'),
    userEmailValue: document.getElementById('userEmailValue'),
    userFirstName: document.getElementById('userFirstName'),
    userLastName: document.getElementById('userLastName'),
    userRole: document.getElementById('userRole'),

    // Study info
    studyInfoContent: document.getElementById('studyInfoContent'),

    // Tests elements
    testsCount: document.getElementById('testsCount'),
    testsLoading: document.getElementById('testsLoading'),
    testsGrid: document.getElementById('testsGrid'),
    emptyTests: document.getElementById('emptyTests'),

    // Inventory elements
    inventoryLoading: document.getElementById('inventoryLoading'),
    inventoryGrid: document.getElementById('inventoryGrid'),
    inventoryEmpty: document.getElementById('inventoryEmpty'),
    userAvatarFrame: document.getElementById('userAvatarFrame'),

    // Teacher elements
    teacherInterface: document.getElementById('teacherInterface'),
    studentInterface: document.getElementById('studentInterface'),
    teacherAvatar: document.getElementById('teacherAvatar'),
    teacherName: document.getElementById('teacherName'),
    teacherEmail: document.getElementById('teacherEmail'),
    teacherEmailValue: document.getElementById('teacherEmailValue'),
    teacherFirstName: document.getElementById('teacherFirstName'),
    teacherLastName: document.getElementById('teacherLastName'),
    teacherBuilding: document.getElementById('teacherBuilding'),
    totalTestsCount: document.getElementById('totalTestsCount'),
    activeTestsCount: document.getElementById('activeTestsCount'),
    teacherTestsCount: document.getElementById('teacherTestsCount'),
    teacherTestsGrid: document.getElementById('teacherTestsGrid'),
    teacherEmptyTests: document.getElementById('teacherEmptyTests'),
    // Buttons
    logoutBtn: document.getElementById('logoutBtn')
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    console.log('Profile HTML loaded');
    initializeEventListeners();
    // Запрашиваем данные профиля при загрузке
    sendMessageToParent({ type: 'LOAD_PROFILE_REQUEST' });
});

function initializeEventListeners() {
    // Logout buttons
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.logoutErrorBtn.addEventListener('click', handleLogout);
    elements.logoutNotFoundBtn.addEventListener('click', handleLogout);

    // Retry button
    elements.retryBtn.addEventListener('click', handleRetry);

    // Recreate profile button
    elements.recreateProfileBtn.addEventListener('click', handleRecreateProfile);

    // Avatar functionality (student)
    elements.avatarContainer.addEventListener('click', handleAvatarClick);
    elements.cancelAvatarBtn.addEventListener('click', handleCancelAvatar);
    elements.saveAvatarBtn.addEventListener('click', handleSaveAvatar);
    elements.useUrlBtn.addEventListener('click', handleUseUrl);

    // Avatar functionality (teacher)
    var teacherAvatarContainer = document.getElementById('teacherAvatarContainer');
    if (teacherAvatarContainer) {
        teacherAvatarContainer.addEventListener('click', handleAvatarClick);
    }

    // Statistics functionality
    const statsByTestBtn = document.getElementById('statsByTestBtn');
    const statsByParamBtn = document.getElementById('statsByParamBtn');
    const statsTestSelect = document.getElementById('statsTestSelect');
    const statsParamType = document.getElementById('statsParamType');
    const statsParamValue = document.getElementById('statsParamValue');

    if (statsByTestBtn) {
        statsByTestBtn.addEventListener('click', () => {
            const testPanel = document.getElementById('statsByTestPanel');
            const paramPanel = document.getElementById('statsByParamPanel');
            paramPanel.style.display = 'none';
            testPanel.style.display = testPanel.style.display === 'none' ? 'block' : 'none';
            if (testPanel.style.display === 'block') {
                sendMessageToParent({ type: 'LOAD_STATS_TESTS_LIST_REQUEST' });
            }
        });
    }

    if (statsByParamBtn) {
        statsByParamBtn.addEventListener('click', () => {
            const paramPanel = document.getElementById('statsByParamPanel');
            const testPanel = document.getElementById('statsByTestPanel');
            testPanel.style.display = 'none';
            paramPanel.style.display = paramPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (statsTestSelect) {
        statsTestSelect.addEventListener('change', function () {
            if (this.value) {
                sendMessageToParent({ type: 'LOAD_STATS_BY_TEST_REQUEST', data: { testId: this.value } });
            } else {
                document.getElementById('statsTestResult').innerHTML = '';
            }
        });
    }

    if (statsParamType) {
        statsParamType.addEventListener('change', function () {
            const valueSelect = document.getElementById('statsParamValue');
            const resultDiv = document.getElementById('statsParamResult');
            const cascade = document.getElementById('statsStudentCascade');
            const stGroup = document.getElementById('statsStGroup');
            const stStudent = document.getElementById('statsStStudent');
            resultDiv.innerHTML = '';
            if (this.value === 'student') {
                if (valueSelect) valueSelect.style.display = 'none';
                if (cascade) cascade.style.display = 'block';
                if (stGroup) {
                    stGroup.innerHTML = '<option value="">-- Группа --</option>';
                    stGroup.disabled = true;
                }
                if (stStudent) {
                    stStudent.innerHTML = '<option value="">-- Студент --</option>';
                    stStudent.disabled = true;
                }
                sendMessageToParent({ type: 'LOAD_STATS_STUDENT_COURSES_REQUEST' });
            } else if (this.value) {
                if (cascade) cascade.style.display = 'none';
                if (valueSelect) valueSelect.style.display = 'block';
                sendMessageToParent({ type: 'LOAD_STATS_PARAM_OPTIONS_REQUEST', data: { paramType: this.value } });
            } else {
                if (cascade) cascade.style.display = 'none';
                if (valueSelect) valueSelect.style.display = 'none';
            }
        });
    }

    if (statsParamValue) {
        statsParamValue.addEventListener('change', function () {
            const paramType = document.getElementById('statsParamType').value;
            if (this.value && paramType && paramType !== 'student') {
                sendMessageToParent({
                    type: 'LOAD_STATS_BY_PARAM_REQUEST',
                    data: { paramType, paramValue: this.value }
                });
            } else {
                document.getElementById('statsParamResult').innerHTML = '';
            }
        });
    }

    const statsStCourse = document.getElementById('statsStCourse');
    if (statsStCourse) {
        statsStCourse.addEventListener('change', function () {
            document.getElementById('statsParamResult').innerHTML = '';
            const stGroup = document.getElementById('statsStGroup');
            const stStudent = document.getElementById('statsStStudent');
            if (stGroup) {
                stGroup.innerHTML = '<option value="">-- Группа --</option>';
                stGroup.disabled = !this.value;
            }
            if (stStudent) {
                stStudent.innerHTML = '<option value="">-- Студент --</option>';
                stStudent.disabled = true;
            }
            if (this.value) {
                sendMessageToParent({ type: 'LOAD_STATS_STUDENT_GROUPS_REQUEST', data: { courseId: this.value } });
            }
        });
    }

    const statsStGroup = document.getElementById('statsStGroup');
    if (statsStGroup) {
        statsStGroup.addEventListener('change', function () {
            document.getElementById('statsParamResult').innerHTML = '';
            const stStudent = document.getElementById('statsStStudent');
            if (stStudent) {
                stStudent.innerHTML = '<option value="">-- Студент --</option>';
                stStudent.disabled = !this.value;
            }
            if (this.value) {
                sendMessageToParent({ type: 'LOAD_STATS_STUDENT_LIST_REQUEST', data: { groupId: this.value } });
            }
        });
    }

    const statsStStudent = document.getElementById('statsStStudent');
    if (statsStStudent) {
        statsStStudent.addEventListener('change', function () {
            if (this.value) {
                sendMessageToParent({
                    type: 'LOAD_STATS_BY_PARAM_REQUEST',
                    data: { paramType: 'student', paramValue: this.value }
                });
            } else {
                document.getElementById('statsParamResult').innerHTML = '';
            }
        });
    }
}

// Communication with React parent
function sendMessageToParent(message) {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(message, window.location.origin);
    }
}

// Message handlers from React
window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    if (event.data == null || typeof event.data !== 'object') return;

    const { type, data } = event.data;

    switch (type) {
        case 'PROFILE_LOADED':
            handleProfileLoaded(data.profile, data.role);
            break;

        case 'TESTS_LOADED':
            handleTestsLoaded(data.tests);
            break;

        case 'TEACHER_DATA_LOADED':
            handleTeacherDataLoaded(data.tests, data.stats);
            break;

        case 'PROFILE_NOT_FOUND':
            handleProfileNotFound(data.error);
            break;

        case 'LOADING_STATE':
            handleLoadingState(data.loading, data.resource);
            break;

        case 'ERROR_STATE':
            handleErrorState(data.error);
            break;

        case 'PROFILE_RECREATED':
            handleProfileRecreated();
            break;

        case 'AVATAR_UPDATED':
            handleAvatarUpdated(data.avatarUrl);
            break;

        case 'TEST_CREATED':
            handleTestCreated(data.test);
            break;

        case 'TEST_DELETED':
            handleTestDeleted(data.testId);
            break;

        case 'INVENTORY_LOADED':
            handleInventoryLoaded(data.cosmetics, data.bonuses);
            break;

        case 'ITEM_APPLIED':
            handleItemApplied(data.itemType, data.itemId);
            break;

        case 'ITEM_REMOVED':
            handleItemRemoved(data.itemType);
            break;

        case 'STATS_TESTS_LIST_LOADED':
            handleStatsTestsListLoaded(data.tests);
            break;

        case 'STATS_BY_TEST_LOADED':
            handleStatsByTestLoaded(data.stats);
            break;

        case 'STATS_PARAM_OPTIONS_LOADED':
            handleStatsParamOptionsLoaded(data.options, data.paramType);
            break;

        case 'STATS_BY_PARAM_LOADED':
            handleStatsByParamLoaded(data.stats);
            break;

        case 'STATS_STUDENT_COURSES_LOADED':
            handleStatsStudentCoursesLoaded(data.options);
            break;

        case 'STATS_STUDENT_GROUPS_LOADED':
            handleStatsStudentGroupsLoaded(data.options);
            break;

        case 'STATS_STUDENT_LIST_LOADED':
            handleStatsStudentListLoaded(data.options);
            break;

        case 'THEME_SYNC':
            document.documentElement.classList.toggle('qf-theme-alt', !!data.isDark);
            document.documentElement.classList.toggle('qf-a11y', !!data.isA11y);
            break;
    }
});

// Event Handlers
function handleLogout() {
    sendMessageToParent({ type: 'LOGOUT_REQUEST' });
}

function handleRetry() {
    hideAllStates();
    showLoadingState();
    sendMessageToParent({ type: 'LOAD_PROFILE_REQUEST' });
}

function handleRecreateProfile() {
    sendMessageToParent({ type: 'RECREATE_PROFILE_REQUEST' });
}

function handleAvatarClick() {
    showAvatarModal();
}

function handleCancelAvatar() {
    hideAvatarModal();
}

function handleSaveAvatar() {
    if (state.selectedAvatar) {
        let avatarUrl = '';

        if (state.selectedAvatar.type === 'image') {
            avatarUrl = state.selectedAvatar.url;
        } else if (state.selectedAvatar.type === 'custom') {
            avatarUrl = state.selectedAvatar.url;
        }

        sendMessageToParent({
            type: 'UPDATE_AVATAR_REQUEST',
            data: { avatarUrl: avatarUrl }
        });
        hideAvatarModal();
    } else {
        alert('Пожалуйста, выберите аватар или введите URL');
    }
}

function handleUseUrl() {
    const url = elements.avatarUrlInput.value.trim();
    if (url) {
        if (isValidUrl(url)) {
            state.selectedAvatar = {
                type: 'custom',
                url: url
            };
            updateSelectedAvatarInModal();
            alert('URL установлен! Нажмите "Сохранить" для применения.');
        } else {
            alert('Пожалуйста, введите корректный URL (начинается с http:// или https://)');
        }
    } else {
        alert('Пожалуйста, введите URL');
    }
}

function handleCreateTestClick() {
    showCreateTestModal();
}

function handleProfileLoaded(profile, role) {
    state.profile = profile;
    state.role = role;
    state.avatarOptions = role === 'teacher' ? AVATAR_OPTIONS_TEACHER : AVATAR_OPTIONS_STUDENT;
    state.loading = false;

    hideAllStates();
    showMainContent();

    if (role === 'teacher') {
        showTeacherInterface();
        updateTeacherProfileUI(profile);
        // Загружаем данные преподавателя
        sendMessageToParent({ type: 'LOAD_TEACHER_DATA_REQUEST', data: { teacherId: profile.id } });
    } else {
        showStudentInterface();
        updateStudentProfileUI(profile);
        showInventoryLoading();
        if (profile.group_id) {
            sendMessageToParent({ type: 'LOAD_TESTS_REQUEST', data: { groupId: profile.group_id } });
        } else {
            showEmptyTests();
        }
        sendMessageToParent({ type: 'LOAD_INVENTORY_REQUEST', data: { profileId: profile.id } });
    }
}

function handleTestsLoaded(tests) {
    state.availableTests = tests;
    state.testsLoading = false;

    updateStudentTestsUI(tests);
}

function handleTeacherDataLoaded(tests, stats) {
    state.teacherTests = tests;

    updateTeacherTestsUI(tests);
    updateTeacherStatsUI(stats);
}

function handleProfileNotFound(error) {
    state.profileNotFound = true;
    state.error = error;
    state.loading = false;

    hideAllStates();
    showProfileNotFound();
}

function handleLoadingState(loading, resource) {
    if (resource === 'profile') {
        state.loading = loading;
        if (loading) {
            showLoadingState();
        }
    } else if (resource === 'tests') {
        state.testsLoading = loading;
        if (loading) {
            showTestsLoading();
        }
    }
}

function handleErrorState(error) {
    state.error = error;
    state.loading = false;

    hideAllStates();
    showErrorState(error);
}

function handleProfileRecreated() {
    // Перезагружаем профиль после создания
    sendMessageToParent({ type: 'LOAD_PROFILE_REQUEST' });
}

function handleAvatarUpdated(avatarUrl) {
    if (state.profile) {
        state.profile.avatar_url = avatarUrl;
        if (state.role === 'teacher') {
            updateTeacherAvatarUI();
        } else {
            updateStudentAvatarUI();
        }
        alert('Аватар успешно обновлен!');
    }
}

function handleTestCreated(test) {
    // Обновляем список тестов преподавателя
    sendMessageToParent({ type: 'LOAD_TEACHER_DATA_REQUEST', data: { teacherId: state.profile.id } });
    hideCreateTestModal();
    alert('Тест успешно создан!');
}

// UI Updates
function hideAllStates() {
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.profileNotFound.style.display = 'none';
    elements.mainContent.style.display = 'none';
}

function showLoadingState() {
    hideAllStates();
    elements.loadingState.style.display = 'flex';
}

function showErrorState(error) {
    hideAllStates();
    elements.errorTitle.textContent = 'Ошибка загрузки профиля';
    elements.errorMessage.textContent = error;
    elements.errorState.style.display = 'block';
}

function showProfileNotFound() {
    hideAllStates();
    elements.profileNotFound.style.display = 'block';
}

function showMainContent() {
    hideAllStates();
    elements.mainContent.style.display = 'block';
}

function showStudentInterface() {
    elements.studentInterface.style.display = 'block';
    elements.teacherInterface.style.display = 'none';
}

function showTeacherInterface() {
    elements.studentInterface.style.display = 'none';
    elements.teacherInterface.style.display = 'block';
}

function showTestsLoading() {
    elements.testsGrid.style.display = 'none';
    elements.emptyTests.style.display = 'none';
    elements.testsLoading.style.display = 'flex';
}

function showEmptyTests() {
    elements.testsGrid.style.display = 'none';
    elements.testsLoading.style.display = 'none';
    elements.emptyTests.style.display = 'block';
}

function showAvatarModal() {
    populateAvatarOptions();
    elements.avatarModal.classList.remove('hidden');
}

function hideAvatarModal() {
    elements.avatarModal.classList.add('hidden');
    state.selectedAvatar = null;
    elements.avatarUrlInput.value = '';
}

function showCreateTestModal() {
    document.getElementById('createTestModal').classList.remove('hidden');
}

function hideCreateTestModal() {
    document.getElementById('createTestModal').classList.add('hidden');
    document.getElementById('createTestForm').reset();
}

// Student UI Updates
function updateStudentProfileUI(profile) {
    const firstName = profile.first_name || 'Не указано';
    const lastName = profile.last_name || 'Не указано';
    const email = profile.email || 'Не указано';

    updateStudentAvatarUI();

    // Name and email
    elements.userEmail.textContent = email;
    elements.userEmailValue.textContent = email;
    elements.userFirstName.textContent = firstName;
    elements.userLastName.textContent = lastName;
    elements.userRole.textContent = 'Студент';

    refreshNameDisplay();
    updateStudyInfoUI(profile);
}

function updateStudentAvatarUI() {
    const profile = state.profile;

    if (profile.avatar_url) {
        if (profile.avatar_url.startsWith('data:image/svg+xml') ||
            profile.avatar_url.startsWith('http') ||
            profile.avatar_url.startsWith('https') ||
            profile.avatar_url.startsWith('/')) {

            elements.userAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" class="avatar-image">`;
            elements.userAvatar.style.background = 'transparent';

            const img = elements.userAvatar.querySelector('img');
            if (img) {
                img.onerror = function () { showDefaultStudentAvatar(); };
            }
        } else {
            showDefaultStudentAvatar();
        }
    } else {
        showDefaultStudentAvatar();
    }

    refreshAvatarFrame();
}

function showDefaultStudentAvatar() {
    elements.userAvatar.innerHTML = '<img src="/icons/Standard_avatar.png" alt="Аватар" class="avatar-image">';
    elements.userAvatar.style.background = 'transparent';
}

function updateStudyInfoUI(profile) {
    const hasGroupInfo = profile.student_groups &&
        profile.student_groups.courses &&
        profile.student_groups.courses.buildings;

    let studyInfoHTML = '';

    if (hasGroupInfo) {
        const building = profile.student_groups.courses.buildings.name;
        const course = profile.student_groups.courses.course_number;
        const group = profile.student_groups.group_number;

        studyInfoHTML = `
            <div class="study-item study-building">
                <span class="study-label">Корпус:</span>
                <span class="study-value">${building}</span>
            </div>
            <div class="study-item study-course">
                <span class="study-label">Курс:</span>
                <span class="study-value">${course} курс</span>
            </div>
            <div class="study-item study-group">
                <span class="study-label">Группа:</span>
                <span class="study-value">${group}</span>
            </div>
        `;
    } else {
        studyInfoHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p class="empty-description">
                    ${profile.group_id ? 'Данные группы загружаются...' : 'Учебная группа не назначена'}
                </p>
            </div>
        `;
    }

    elements.studyInfoContent.innerHTML = studyInfoHTML;
}

function updateStudentTestsUI(tests) {
    elements.testsCount.textContent = `${tests.length} тест${getRussianPlural(tests.length)}`;

    if (tests.length === 0) {
        showEmptyTests();
        return;
    }

    elements.testsLoading.style.display = 'none';
    elements.emptyTests.style.display = 'none';

    elements.testsGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    tests.forEach(test => {
        const questionsCount = test.questions_count || 'Не указано';
        const timeLimit = test.time_limit_minutes ? `${test.time_limit_minutes} мин` : 'Не ограничено';

        const card = document.createElement('div');
        card.className = 'test-card';

        const header = document.createElement('div');
        header.className = 'test-header';

        const titleWrap = document.createElement('div');
        const titleEl = document.createElement('h4');
        titleEl.className = 'test-title';
        titleEl.textContent = test.title || '';
        titleWrap.appendChild(titleEl);

        const statusEl = document.createElement('span');
        statusEl.className = 'test-status';
        statusEl.textContent = 'Доступен';

        header.appendChild(titleWrap);
        header.appendChild(statusEl);

        const descEl = document.createElement('p');
        descEl.className = 'test-description';
        descEl.textContent = test.description || 'Описание отсутствует';

        const metaEl = document.createElement('div');
        metaEl.className = 'test-meta';

        const qEl = document.createElement('span');
        qEl.textContent = `Вопросов: ${questionsCount}`;

        const limitEl = document.createElement('span');
        limitEl.textContent = `Лимит: ${timeLimit}`;

        metaEl.appendChild(qEl);
        metaEl.appendChild(limitEl);

        const startBtn = document.createElement('button');
        startBtn.className = 'start-test-btn';
        startBtn.type = 'button';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
            <path stroke-linecap="round" stroke-linejoin="round"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        `;

        startBtn.appendChild(svg);
        startBtn.appendChild(document.createTextNode('Начать тест'));
        startBtn.addEventListener('click', function () {
            handleStartTest(test.id);
        });

        card.appendChild(header);
        card.appendChild(descEl);
        card.appendChild(metaEl);
        card.appendChild(startBtn);

        fragment.appendChild(card);
    });

    elements.testsGrid.appendChild(fragment);
    elements.testsGrid.style.display = 'grid';
}

// Teacher UI Updates
function updateTeacherProfileUI(profile) {
    const firstName = profile.first_name || 'Не указано';
    const lastName = profile.last_name || 'Не указано';
    const email = profile.email || 'Не указано';
    const building = profile.teachers && profile.teachers[0] && profile.teachers[0].buildings ?
        profile.teachers[0].buildings.name : 'Не указан';

    // Avatar
    updateTeacherAvatarUI();

    // User info
    elements.teacherName.textContent = `${firstName} ${lastName}`;
    elements.teacherEmail.textContent = email;
    elements.teacherEmailValue.textContent = email;
    elements.teacherFirstName.textContent = firstName;
    elements.teacherLastName.textContent = lastName;
    elements.teacherBuilding.textContent = building;
}

function updateTeacherAvatarUI() {
    const profile = state.profile;

    if (profile.avatar_url) {
        if (profile.avatar_url.startsWith('data:image/svg+xml') ||
            profile.avatar_url.startsWith('http') ||
            profile.avatar_url.startsWith('https') ||
            profile.avatar_url.startsWith('/')) {

            elements.teacherAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" class="avatar-image">`;
            elements.teacherAvatar.style.background = 'transparent';

            const img = elements.teacherAvatar.querySelector('img');
            if (img) {
                img.onerror = function () { showDefaultTeacherAvatar(); };
            }
        } else {
            showDefaultTeacherAvatar();
        }
    } else {
        showDefaultTeacherAvatar();
    }
}

function showDefaultTeacherAvatar() {
    elements.teacherAvatar.innerHTML = '<img src="/icons/Standard_avatar.png" alt="Аватар" class="avatar-image">';
    elements.teacherAvatar.style.background = 'transparent';
}

function updateTeacherStatsUI(stats) {
    elements.totalTestsCount.textContent = stats.totalTests;
    elements.activeTestsCount.textContent = stats.activeTests;
}

function updateTeacherTestsUI(tests) {
    elements.teacherTestsCount.textContent = `${tests.length} тест${getRussianPlural(tests.length)}`;

    if (tests.length === 0) {
        elements.teacherTestsGrid.style.display = 'none';
        elements.teacherEmptyTests.style.display = 'block';
        return;
    }

    elements.teacherTestsGrid.style.display = 'grid';
    elements.teacherEmptyTests.style.display = 'none';

    let testsHTML = '';

    tests.forEach(test => {
        const questionsCount = test.questions_count || '0';
        const timeLimit = test.time_limit_minutes ? `${test.time_limit_minutes} мин` : 'Не ограничено';
        const status = test.is_active ? 'active' : 'inactive';
        const statusText = test.is_active ? 'Активен' : 'Неактивен';

        testsHTML += `
            <div class="teacher-test-card">
                <div class="test-header">
                    <div>
                        <h4 class="test-title">${test.title}</h4>
                        <p class="test-description">${test.description || 'Описание отсутствует'}</p>
                    </div>
                    <span class="test-status ${status}">${statusText}</span>
                </div>
                <div class="test-meta">
                    <span>Вопросов: ${questionsCount}</span>
                    <span>Лимит: ${timeLimit}</span>
                    <span>Попыток: ${test.max_attempts || 1}</span>
                </div>
                <div class="test-actions">
                    <button class="test-action-btn" onclick="handleEditTest('${test.id}')">Редактировать</button>
                    <button class="test-action-btn primary" onclick="handleAssignGroups('${test.id}')">Назначить группам</button>
                    <button class="test-action-btn danger" onclick="handleDeleteTest('${test.id}')">Удалить</button>
                </div>
            </div>
        `;
    });

    elements.teacherTestsGrid.innerHTML = testsHTML;
}

function handleDeleteTest(testId) {
    if (confirm('Вы уверены, что хотите удалить этот тест? Это действие нельзя отменить.')) {
        sendMessageToParent({
            type: 'DELETE_TEST_REQUEST',
            data: { testId }
        });
    }
}

function handleTestDeleted(testId) {
    // Удаляем тест из состояния
    state.teacherTests = state.teacherTests.filter(test => test.id !== testId);

    // Обновляем UI
    updateTeacherTestsUI(state.teacherTests);
    updateTeacherStatsUI({
        totalTests: state.teacherTests.length,
        activeTests: state.teacherTests.filter(test => test.is_active).length
    });

    alert('Тест успешно удален!');
}

// Helper functions
function getRussianPlural(number) {
    if (number % 10 === 1 && number % 100 !== 11) {
        return '';
    } else if ([2, 3, 4].includes(number % 10) && ![12, 13, 14].includes(number % 100)) {
        return 'а';
    } else {
        return 'ов';
    }
}

function generateColorAvatarURL(color, text) {
    const svg = `
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" fill="${color}" rx="50"/>
            <text x="50" y="55" text-anchor="middle" fill="white" font-family="'Gothic A1', sans-serif" font-size="36" font-weight="900">${text}</text>
        </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function isValidUrl(string) {
    try {
        new URL(string);
        return string.startsWith('http://') || string.startsWith('https://');
    } catch (_) {
        return false;
    }
}

function handleStartTest(testId) {
    sendMessageToParent({
        type: 'START_TEST_REQUEST',
        data: { testId }
    });
}

function handleEditTest(testId) {
    sendMessageToParent({
        type: 'EDIT_TEST_REQUEST',
        data: { testId }
    });
}

function handleAssignGroups(testId) {
    sendMessageToParent({
        type: 'ASSIGN_GROUPS_REQUEST',
        data: { testId }
    });
}

// Avatar modal functions
function populateAvatarOptions() {
    let optionsHTML = '';

    state.avatarOptions.forEach((option) => {
        const isSelected = state.selectedAvatar && state.selectedAvatar.id === option.id;

        if (option.type === 'image') {
            optionsHTML += `
                <div class="avatar-option ${isSelected ? 'selected' : ''}"
                     data-id="${option.id}"
                     title="${option.label}">
                    <img src="${option.url}" alt="${option.label}" class="avatar-option-image">
                </div>
            `;
        }
    });

    elements.avatarOptions.innerHTML = optionsHTML;

    elements.avatarOptions.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            const selectedOption = state.avatarOptions.find(opt => opt.id === id);
            if (selectedOption) {
                state.selectedAvatar = { ...selectedOption };
                updateSelectedAvatarInModal();
                elements.avatarUrlInput.value = '';
            }
        });
    });
}

function updateSelectedAvatarInModal() {
    elements.avatarOptions.querySelectorAll('.avatar-option').forEach(option => {
        option.classList.remove('selected');
    });

    if (state.selectedAvatar && state.selectedAvatar.id) {
        const selectedOption = elements.avatarOptions.querySelector(`[data-id="${state.selectedAvatar.id}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    }
}

// Create test form handling
document.addEventListener('DOMContentLoaded', function () {
    const createTestForm = document.getElementById('createTestForm');
    if (createTestForm) {
        createTestForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const testData = {
                title: document.getElementById('testTitle').value,
                description: document.getElementById('testDescription').value,
                timeLimit: document.getElementById('timeLimit').value || null,
                maxAttempts: document.getElementById('maxAttempts').value || 1,
                questionsCount: document.getElementById('questionsCount').value || 0
            };

            sendMessageToParent({
                type: 'CREATE_TEST_REQUEST',
                data: { testData }
            });
        });
    }

    const cancelCreateTestBtn = document.getElementById('cancelCreateTestBtn');
    if (cancelCreateTestBtn) {
        cancelCreateTestBtn.addEventListener('click', hideCreateTestModal);
    }
});

// ─── Inventory ──────────────────────────────────────────────────────────────

function showInventoryLoading() {
    if (elements.inventoryLoading) elements.inventoryLoading.style.display = 'flex';
    if (elements.inventoryGrid)    elements.inventoryGrid.style.display    = 'none';
    if (elements.inventoryEmpty)   elements.inventoryEmpty.style.display   = 'none';
}

function handleInventoryLoaded(cosmetics, bonuses) {
    cosmetics = cosmetics || [];
    bonuses   = bonuses   || [];

    state.activeFrame  = cosmetics.find(c => c.type === 'frame'      && c.is_active) || null;
    state.activeColor  = cosmetics.find(c => c.type === 'name_color' && c.is_active) || null;
    state.activePrefix = cosmetics.find(c => c.type === 'prefix'     && c.is_active) || null;
    state.inventory    = { cosmetics, bonuses };

    refreshAvatarFrame();
    refreshNameDisplay();
    renderInventoryGrid(cosmetics, bonuses);
}

function handleItemApplied(itemType, itemId) {
    if (!state.inventory) return;

    // Only one active per type at a time
    state.inventory.cosmetics = state.inventory.cosmetics.map(c =>
        c.type === itemType ? { ...c, is_active: c.item_id === itemId } : c
    );

    state.activeFrame  = state.inventory.cosmetics.find(c => c.type === 'frame'      && c.is_active) || null;
    state.activeColor  = state.inventory.cosmetics.find(c => c.type === 'name_color' && c.is_active) || null;
    state.activePrefix = state.inventory.cosmetics.find(c => c.type === 'prefix'     && c.is_active) || null;

    refreshAvatarFrame();
    refreshNameDisplay();
    renderInventoryGrid(state.inventory.cosmetics, state.inventory.bonuses);
}

function handleItemRemoved(itemType) {
    if (!state.inventory) return;

    state.inventory.cosmetics = state.inventory.cosmetics.map(c =>
        c.type === itemType ? { ...c, is_active: false } : c
    );

    if (itemType === 'frame')      state.activeFrame  = null;
    else if (itemType === 'name_color') state.activeColor  = null;
    else if (itemType === 'prefix')     state.activePrefix = null;

    refreshAvatarFrame();
    refreshNameDisplay();
    renderInventoryGrid(state.inventory.cosmetics, state.inventory.bonuses);
}

// ─── Cosmetic display helpers ────────────────────────────────────────────────

function refreshAvatarFrame() {
    const frameEl = elements.userAvatarFrame;
    if (!frameEl) return;
    if (state.activeFrame && state.activeFrame.image_url) {
        frameEl.src = state.activeFrame.image_url;
        frameEl.style.display = 'block';
    } else {
        frameEl.style.display = 'none';
        frameEl.src = '';
    }
}

function refreshNameDisplay() {
    if (!state.profile) return;
    const firstName = state.profile.first_name || 'Не указано';
    const lastName  = state.profile.last_name  || 'Не указано';
    const nameEl    = elements.userName;

    if (state.activePrefix) {
        nameEl.innerHTML = `<span style="color:#6b7280;font-weight:600;margin-right:6px;">${escapeHtml(state.activePrefix.name)}</span>${escapeHtml(firstName + ' ' + lastName)}`;
    } else {
        nameEl.textContent = `${firstName} ${lastName}`;
    }

    nameEl.style.color = (state.activeColor && state.activeColor.hex_code) ? state.activeColor.hex_code : '';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Inventory grid renderer ─────────────────────────────────────────────────

function renderInventoryGrid(cosmetics, bonuses) {
    const grid    = elements.inventoryGrid;
    const loading = elements.inventoryLoading;
    const empty   = elements.inventoryEmpty;
    if (!grid) return;

    if (loading) loading.style.display = 'none';

    if (!cosmetics.length && !bonuses.length) {
        grid.style.display  = 'none';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();

    // Cosmetic cards
    cosmetics.forEach(item => {
        const card = document.createElement('div');
        card.className = 'inv-card' + (item.is_active ? ' is-active' : '');

        const preview = buildCosmeticPreview(item);

        const nameEl = document.createElement('div');
        nameEl.className = 'inv-card__name';
        nameEl.textContent = item.name;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'inv-card__btn ' + (item.is_active ? 'inv-card__btn--remove' : 'inv-card__btn--apply');
        btn.textContent = item.is_active ? 'Убрать' : 'Применить';
        btn.addEventListener('click', () => {
            if (item.is_active) {
                sendMessageToParent({ type: 'REMOVE_ITEM_REQUEST', data: { itemType: item.type } });
            } else {
                sendMessageToParent({ type: 'APPLY_ITEM_REQUEST', data: { itemType: item.type, itemId: item.item_id } });
            }
        });

        card.appendChild(preview);
        card.appendChild(nameEl);
        card.appendChild(btn);
        frag.appendChild(card);
    });

    // Bonus cards
    bonuses.forEach(bonus => {
        const card = document.createElement('div');
        card.className = 'inv-card';

        const preview = document.createElement('div');
        preview.className = 'inv-card__preview';
        preview.innerHTML = `<span style="font-size:36px;line-height:1;display:block;">${getBonusIcon(bonus.name, bonus.bonus_id)}</span>`;

        const badge = document.createElement('div');
        badge.className = 'inv-card__badge';
        badge.textContent = bonus.quantity > 99 ? '99+' : bonus.quantity;
        preview.appendChild(badge);

        const nameEl = document.createElement('div');
        nameEl.className = 'inv-card__name';
        nameEl.textContent = bonus.name;

        card.appendChild(preview);
        card.appendChild(nameEl);
        frag.appendChild(card);
    });

    grid.appendChild(frag);
    grid.style.display = 'grid';
}

function buildCosmeticPreview(item) {
    const preview = document.createElement('div');
    preview.className = 'inv-card__preview';

    if (item.type === 'frame' && item.image_url) {
        const img = document.createElement('img');
        img.src = item.image_url;
        img.alt = item.name;
        preview.appendChild(img);

    } else if (item.type === 'name_color' && item.hex_code) {
        // Show the letter in the chosen colour on a neutral background — same
        // visual language as the shop card where the user's name appears coloured.
        preview.style.cssText = `width:64px;height:64px;border-radius:50%;background:#f0f4f8;border:3px solid ${item.hex_code};`;
        preview.innerHTML = `<span style="color:${item.hex_code};font-weight:900;font-size:26px;font-family:sans-serif;line-height:1;">А</span>`;

    } else if (item.type === 'prefix') {
        // white-space:nowrap so the badge never wraps; the card is wide enough to
        // hold the full text since the grid column is minmax(130px, 1fr).
        preview.innerHTML = `<span style="display:inline-block;padding:3px 10px;border-radius:20px;background:#f3f4f6;font-size:11px;font-weight:700;color:#374151;white-space:nowrap;">${escapeHtml(item.name)}</span>`;
    }

    return preview;
}

function getBonusIcon(name, id) {
    const n = (name || '').toLowerCase();
    const i = (id   || '').toLowerCase();
    if (n.includes('попытк') || i.includes('attempt')) return '↩️';
    if (n.includes('подсказк') || i.includes('hint'))  return '💡';
    if (n.includes('пропус') || i.includes('skip'))    return '⏭️';
    return '🎁';
}

// ─── Statistics handlers ─────────────────────────────────────────────────────

function handleStatsTestsListLoaded(tests) {
    const sel = document.getElementById('statsTestSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Выберите тест --</option>';
    (tests || []).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.title || 'Без названия';
        sel.appendChild(opt);
    });
}

function handleStatsByTestLoaded(stats) {
    const div = document.getElementById('statsTestResult');
    if (!div) return;

    if (!stats || !stats.rows) {
        div.innerHTML = '<p style="color:#6b7280;font-size:14px;font-weight:500;">Нет данных по этому тесту.</p>';
        return;
    }

    if (stats.rows.length === 0) {
        div.innerHTML = '<p style="color:#6b7280;font-size:14px;font-weight:500;">Нет назначенных групп или данных по этому тесту.</p>';
        return;
    }

    const title = stats.testTitle
        ? `<p style="font-weight:700; margin-bottom:10px; color:#374151;">${escapeHtml(stats.testTitle)}</p>`
        : '';

    let html =
        title +
        `
        <div style="overflow-x:auto; margin-top:8px;">
            <table style="width:100%; border-collapse:collapse; font-size:14px; font-family:inherit;">
                <thead>
                    <tr style="border-bottom:2px solid #e5e7eb;">
                        <th style="text-align:left; padding:10px 12px; font-weight:700; color:#374151;">Группа</th>
                        <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Прошли (чел.)</th>
                        <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Средний балл</th>
                        <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Завершено попыток</th>
                    </tr>
                </thead>
                <tbody>
    `;

    stats.rows.forEach((row) => {
        html += `
            <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:10px 12px; color:#111827; font-weight:500;">${escapeHtml(row.groupTitle || '—')}</td>
                <td style="text-align:center; padding:10px 12px; color:#6b7280;">${row.peoplePassed ?? 0}</td>
                <td style="text-align:center; padding:10px 12px; color:#6b7280;">${row.avgScore != null ? row.avgScore.toFixed(1) + '%' : '—'}</td>
                <td style="text-align:center; padding:10px 12px; color:#6b7280;">${row.completedAttempts ?? 0}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    div.innerHTML = html;
}

function handleStatsParamOptionsLoaded(options, paramType) {
    const sel = document.getElementById('statsParamValue');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Выберите значение --</option>';
    (options || []).forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.name;
        sel.appendChild(opt);
    });
    sel.style.display = 'block';
    document.getElementById('statsParamResult').innerHTML = '';
}

function handleStatsStudentCoursesLoaded(options) {
    const sel = document.getElementById('statsStCourse');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Курс --</option>';
    (options || []).forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.name;
        sel.appendChild(opt);
    });
}

function handleStatsStudentGroupsLoaded(options) {
    const sel = document.getElementById('statsStGroup');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Группа --</option>';
    (options || []).forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.name;
        sel.appendChild(opt);
    });
    sel.disabled = (options || []).length === 0;
}

function handleStatsStudentListLoaded(options) {
    const sel = document.getElementById('statsStStudent');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Студент --</option>';
    (options || []).forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.name;
        sel.appendChild(opt);
    });
    sel.disabled = (options || []).length === 0;
}

function handleStatsByParamLoaded(stats) {
    const div = document.getElementById('statsParamResult');
    if (!div) return;

    if (!stats) {
        div.innerHTML = '<p style="color:#6b7280;font-size:14px;font-weight:500;">Нет данных по этому параметру.</p>';
        return;
    }

    if (stats.mode === 'student') {
        if (stats.rows.length === 0) {
            div.innerHTML =
                '<p style="color:#6b7280;font-size:14px;font-weight:500;">Нет назначенных тестов для группы студента или нет данных.</p>';
            return;
        }
        const name = stats.studentName
            ? `<p style="font-weight:700; margin-bottom:10px; color:#374151;">${escapeHtml(stats.studentName)}</p>`
            : '';
        let html =
            name +
            `
            <div style="overflow-x:auto; margin-top:8px;">
                <table style="width:100%; border-collapse:collapse; font-size:14px; font-family:inherit;">
                    <thead>
                        <tr style="border-bottom:2px solid #e5e7eb;">
                            <th style="text-align:left; padding:10px 12px; font-weight:700; color:#374151;">Тест</th>
                            <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Статус</th>
                            <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Ошибок</th>
                            <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Время</th>
                            <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Правильность, %</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        stats.rows.forEach((row) => {
            const status = row.passed
                ? '<span style="color:#059669;font-weight:600;">Пройден</span>'
                : '<span style="color:#9ca3af;">Не пройден</span>';
            const err = row.errors !== null && row.errors !== undefined ? row.errors : '—';
            const pct =
                row.correctnessPct != null ? row.correctnessPct.toFixed(1) + '%' : '—';
            html += `
                <tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:10px 12px; color:#111827; font-weight:500;">${escapeHtml(row.testTitle || 'Без названия')}</td>
                    <td style="text-align:center; padding:10px 12px;">${status}</td>
                    <td style="text-align:center; padding:10px 12px; color:#6b7280;">${err}</td>
                    <td style="text-align:center; padding:10px 12px; color:#6b7280;">${escapeHtml(row.timeDisplay || '—')}</td>
                    <td style="text-align:center; padding:10px 12px; color:#6b7280;">${pct}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        div.innerHTML = html;
        return;
    }

    let summaryHtml = '';
    if (stats.summary) {
        const s = stats.summary;
        const pct = s.pctFinishedAll != null ? s.pctFinishedAll + '%' : '—';
        const most = s.mostErrors
            ? `${escapeHtml(s.mostErrors.name)} (${s.mostErrors.errors})`
            : '—';
        const few = s.fewestErrors
            ? `${escapeHtml(s.fewestErrors.name)} (${s.fewestErrors.errors})`
            : '—';
        const fast = s.fastest
            ? `${escapeHtml(s.fastest.name)} — ${escapeHtml(s.fastest.totalTime)}`
            : 'Нет данных о времени (нужны поля duration_seconds в test_attempts)';
        summaryHtml = `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px,1fr)); gap:10px; margin-bottom:16px;">
                <div style="padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e5e7eb;">
                    <div style="font-size:11px; color:#6b7280; font-weight:600; text-transform:uppercase;">Завершили все назначенные тесты</div>
                    <div style="font-size:20px; font-weight:800; color:#1e40af; margin-top:4px;">${pct}</div>
                    <div style="font-size:12px; color:#6b7280; margin-top:4px;">${s.totalStudents ?? 0} студ., ${s.assignedTests ?? 0} тест.</div>
                </div>
                <div style="padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e5e7eb;">
                    <div style="font-size:11px; color:#6b7280; font-weight:600; text-transform:uppercase;">Больше всего ошибок (сумма)</div>
                    <div style="font-size:14px; font-weight:600; color:#111827; margin-top:6px;">${most}</div>
                </div>
                <div style="padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e5e7eb;">
                    <div style="font-size:11px; color:#6b7280; font-weight:600; text-transform:uppercase;">Меньше всего ошибок (сумма)</div>
                    <div style="font-size:14px; font-weight:600; color:#111827; margin-top:6px;">${few}</div>
                </div>
                <div style="padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e5e7eb;">
                    <div style="font-size:11px; color:#6b7280; font-weight:600; text-transform:uppercase;">Быстрее всех (сумма времени)</div>
                    <div style="font-size:14px; font-weight:600; color:#111827; margin-top:6px;">${fast}</div>
                </div>
            </div>
        `;
    }

    const aggRows = stats.rows || [];
    if (aggRows.length === 0) {
        div.innerHTML =
            summaryHtml +
            '<p style="color:#6b7280;font-size:14px;font-weight:500;margin-top:8px;">Нет строк по тестам для выбранного курса или группы.</p>';
        return;
    }

    let html =
        summaryHtml +
        `
        <div style="overflow-x:auto; margin-top:8px;">
            <table style="width:100%; border-collapse:collapse; font-size:14px; font-family:inherit;">
                <thead>
                    <tr style="border-bottom:2px solid #e5e7eb;">
                        <th style="text-align:left; padding:10px 12px; font-weight:700; color:#374151;">Тест</th>
                        <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Участников</th>
                        <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Прошли (чел.)</th>
                        <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Всего попыток</th>
                        <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Средний балл</th>
                        <th style="text-align:center; padding:10px 12px; font-weight:700; color:#374151;">Завершено попыток</th>
                    </tr>
                </thead>
                <tbody>
    `;

    aggRows.forEach((row) => {
        html += `
            <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:10px 12px; color:#111827; font-weight:500;">${escapeHtml(row.testTitle || 'Без названия')}</td>
                <td style="text-align:center; padding:10px 12px; color:#6b7280;">${row.uniqueParticipants ?? 0}</td>
                <td style="text-align:center; padding:10px 12px; color:#6b7280;">${row.peopleCompleted ?? 0}</td>
                <td style="text-align:center; padding:10px 12px; color:#6b7280;">${row.attempts ?? 0}</td>
                <td style="text-align:center; padding:10px 12px; color:#6b7280;">${row.avgScore != null ? row.avgScore.toFixed(1) + '%' : '—'}</td>
                <td style="text-align:center; padding:10px 12px; color:#6b7280;">${row.completed ?? 0}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    div.innerHTML = html;
}