// profile.js (исправленная версия)
// State management
let state = {
    profile: null,
    availableTests: [],
    teacherTests: [],
    loading: true,
    testsLoading: false,
    error: null,
    profileNotFound: false,
    selectedAvatar: null,
    avatarOptions: [
        {
            id: 'blue',
            type: 'color',
            color: '#3b82f6',
            text: 'ИП'
        },
        {
            id: 'red',
            type: 'color',
            color: '#ef4444',
            text: 'ИП'
        },
        {
            id: 'green',
            type: 'color',
            color: '#10b981',
            text: 'ИП'
        },
        {
            id: 'yellow',
            type: 'color',
            color: '#f59e0b',
            text: 'ИП'
        }
    ]
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
    createTestBtn: document.getElementById('createTestBtn'),

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

    // Avatar functionality
    elements.avatarContainer.addEventListener('click', handleAvatarClick);
    elements.cancelAvatarBtn.addEventListener('click', handleCancelAvatar);
    elements.saveAvatarBtn.addEventListener('click', handleSaveAvatar);
    elements.useUrlBtn.addEventListener('click', handleUseUrl);

    // Teacher functionality
    if (elements.createTestBtn) {
        elements.createTestBtn.addEventListener('click', handleCreateTestClick);
    }
}

// Communication with React parent
function sendMessageToParent(message) {
    console.log('Sending message to parent:', message);
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(message, '*');
    }
}

// Message handlers from React
window.addEventListener('message', function (event) {
    console.log('Received message from parent:', event.data);

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

        if (state.selectedAvatar.type === 'color') {
            // Для цветных аватарок создаем SVG с инициалами пользователя
            const profile = state.profile;
            const firstName = profile.first_name || 'И';
            const lastName = profile.last_name || 'П';
            const avatarText = (firstName[0] || '') + (lastName[0] || '');
            avatarUrl = generateColorAvatarURL(state.selectedAvatar.color, avatarText);
        } else if (state.selectedAvatar.type === 'custom') {
            // Для кастомных URL используем введенный URL
            avatarUrl = state.selectedAvatar.url;
        }

        console.log('Saving avatar:', state.selectedAvatar, 'URL:', avatarUrl);

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
        // Запрашиваем тесты для студента
        if (profile.group_id) {
            sendMessageToParent({ type: 'LOAD_TESTS_REQUEST', data: { groupId: profile.group_id } });
        } else {
            showEmptyTests();
        }
    }
}

// Обновите функцию для преподавателей
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
        if (state.profile.role === 'teacher') {
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

    // Avatar
    updateStudentAvatarUI();

    // User info
    elements.userName.textContent = `${firstName} ${lastName}`;
    elements.userEmail.textContent = email;
    elements.userEmailValue.textContent = email;
    elements.userFirstName.textContent = firstName;
    elements.userLastName.textContent = lastName;
    elements.userRole.textContent = 'Студент';

    // Study info
    updateStudyInfoUI(profile);
}

function updateStudentAvatarUI() {
    const profile = state.profile;

    if (profile.avatar_url) {
        // Проверяем, является ли avatar_url SVG или URL изображением
        if (profile.avatar_url.startsWith('data:image/svg+xml') || 
            profile.avatar_url.startsWith('http') || 
            profile.avatar_url.startsWith('https')) {
            
            elements.userAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" class="avatar-image">`;

            const img = elements.userAvatar.querySelector('img');
            if (img) {
                img.onerror = function () {
                    showDefaultStudentAvatar();
                };
                img.onload = function () {
                    console.log('Avatar image loaded successfully');
                };
            }
        } else {
            showDefaultStudentAvatar();
        }
    } else {
        showDefaultStudentAvatar();
    }
}

function showDefaultStudentAvatar() {
    const profile = state.profile;
    const firstName = profile.first_name || 'И';
    const lastName = profile.last_name || 'П';
    const avatarText = (firstName[0] || '') + (lastName[0] || '');

    elements.userAvatar.innerHTML = '';
    elements.userAvatar.textContent = avatarText;
    elements.userAvatar.style.background = '#3b82f6';
    elements.userAvatar.style.display = 'flex';
    elements.userAvatar.style.alignItems = 'center';
    elements.userAvatar.style.justifyContent = 'center';
    elements.userAvatar.style.lineHeight = '1';
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

    let testsHTML = '';

    tests.forEach(test => {
        const questionsCount = test.questions_count || 'Не указано';
        const timeLimit = test.time_limit ? `${test.time_limit} мин` : 'Не ограничено';
        const createdDate = test.created_at ? new Date(test.created_at).toLocaleDateString('ru-RU') : '';

        testsHTML += `
            <div class="test-card">
                <div class="test-header">
                    <div>
                        <h4 class="test-title">${test.title}</h4>
                    </div>
                    <span class="test-status">Доступен</span>
                </div>
                <p class="test-description">${test.description || 'Описание отсутствует'}</p>
                <div class="test-meta">
                    <span>Вопросов: ${questionsCount}</span>
                    <span>Лимит: ${timeLimit}</span>
                </div>
                <button class="start-test-btn" onclick="handleStartTest('${test.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Начать тест
                </button>
            </div>
        `;
    });

    elements.testsGrid.innerHTML = testsHTML;
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
        // Проверяем, является ли avatar_url SVG или URL изображением
        if (profile.avatar_url.startsWith('data:image/svg+xml') || 
            profile.avatar_url.startsWith('http') || 
            profile.avatar_url.startsWith('https')) {
            
            elements.teacherAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" class="avatar-image">`;

            const img = elements.teacherAvatar.querySelector('img');
            if (img) {
                img.onerror = function () {
                    showDefaultTeacherAvatar();
                };
                img.onload = function () {
                    console.log('Teacher avatar image loaded successfully');
                };
            }
        } else {
            showDefaultTeacherAvatar();
        }
    } else {
        showDefaultTeacherAvatar();
    }
}

function showDefaultTeacherAvatar() {
    const profile = state.profile;
    const firstName = profile.first_name || 'И';
    const lastName = profile.last_name || 'П';
    const avatarText = (firstName[0] || '') + (lastName[0] || '');

    elements.teacherAvatar.innerHTML = '';
    elements.teacherAvatar.textContent = avatarText;
    elements.teacherAvatar.style.background = '#f59e0b';
    elements.teacherAvatar.style.display = 'flex';
    elements.teacherAvatar.style.alignItems = 'center';
    elements.teacherAvatar.style.justifyContent = 'center';
    elements.teacherAvatar.style.lineHeight = '1';
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
        const timeLimit = test.time_limit ? `${test.time_limit} мин` : 'Не ограничено';
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
                </div>
            </div>
        `;
    });

    elements.teacherTestsGrid.innerHTML = testsHTML;
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
            <text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="36" font-weight="bold">${text}</text>
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

    state.avatarOptions.forEach((option, index) => {
        const isSelected = state.selectedAvatar && state.selectedAvatar.id === option.id;

        if (option.type === 'color') {
            optionsHTML += `
                <div class="avatar-option ${isSelected ? 'selected' : ''}" 
                     data-id="${option.id}">
                    <div class="avatar-option-color" style="background: ${option.color}">
                        <span class="avatar-option-initials">${option.text}</span>
                    </div>
                </div>
            `;
        }
    });

    elements.avatarOptions.innerHTML = optionsHTML;

    // Add event listeners to avatar options
    elements.avatarOptions.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            const selectedOption = state.avatarOptions.find(opt => opt.id === id);
            if (selectedOption) {
                state.selectedAvatar = { ...selectedOption };
                updateSelectedAvatarInModal();
                elements.avatarUrlInput.value = ''; // Clear URL input when selecting predefined avatar
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