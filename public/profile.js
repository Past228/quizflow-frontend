// State management
let state = {
    profile: null,
    availableTests: [],
    loading: true,
    testsLoading: false,
    error: null,
    profileNotFound: false,
    selectedAvatar: null,
    avatarOptions: [
        { color: '#3b82f6', text: 'ИП' },
        { color: '#ef4444', text: 'ИП' },
        { color: '#10b981', text: 'ИП' },
        { color: '#f59e0b', text: 'ИП' },
        { color: '#8b5cf6', text: 'ИП' },
        { color: '#06b6d4', text: 'ИП' },
        { color: '#84cc16', text: 'ИП' },
        { color: '#f97316', text: 'ИП' }
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
    avatarUpload: document.getElementById('avatarUpload'),
    uploadTrigger: document.getElementById('uploadTrigger'),
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
    
    // Buttons
    logoutBtn: document.getElementById('logoutBtn')
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
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
    elements.uploadTrigger.addEventListener('click', handleUploadTrigger);
    elements.avatarUpload.addEventListener('change', handleAvatarUpload);
}

// Communication with React parent
function sendMessageToParent(message) {
    console.log('Sending message to parent:', message);
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(message, '*');
    }
}

// Message handlers from React
window.addEventListener('message', function(event) {
    console.log('Received message from parent:', event.data);
    
    const { type, data } = event.data;
    
    switch (type) {
        case 'PROFILE_LOADED':
            handleProfileLoaded(data.profile);
            break;
            
        case 'TESTS_LOADED':
            handleTestsLoaded(data.tests);
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
        sendMessageToParent({
            type: 'UPDATE_AVATAR_REQUEST',
            data: { avatar: state.selectedAvatar }
        });
        hideAvatarModal();
    }
}

function handleUploadTrigger() {
    elements.avatarUpload.click();
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            state.selectedAvatar = {
                type: 'image',
                data: e.target.result
            };
            updateSelectedAvatarInModal();
        };
        reader.readAsDataURL(file);
    }
}

// Data Handlers
function handleProfileLoaded(profile) {
    state.profile = profile;
    state.loading = false;
    
    hideAllStates();
    showMainContent();
    updateProfileUI(profile);
    
    // Запрашиваем тесты после загрузки профиля
    if (profile.group_id) {
        sendMessageToParent({ type: 'LOAD_TESTS_REQUEST', data: { groupId: profile.group_id } });
    } else {
        showEmptyTests();
    }
}

function handleTestsLoaded(tests) {
    state.availableTests = tests;
    state.testsLoading = false;
    
    updateTestsUI(tests);
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
        updateAvatarUI();
    }
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
    elements.avatarUpload.value = '';
}

function populateAvatarOptions() {
    let optionsHTML = '';
    
    state.avatarOptions.forEach((option, index) => {
        const isSelected = state.selectedAvatar && state.selectedAvatar.type === 'color' && state.selectedAvatar.color === option.color;
        optionsHTML += `
            <div class="avatar-option ${isSelected ? 'selected' : ''}" 
                 style="background: ${option.color}"
                 data-index="${index}">
                ${option.text}
            </div>
        `;
    });
    
    elements.avatarOptions.innerHTML = optionsHTML;
    
    // Add event listeners to avatar options
    elements.avatarOptions.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            state.selectedAvatar = {
                type: 'color',
                color: state.avatarOptions[index].color,
                text: state.avatarOptions[index].text
            };
            updateSelectedAvatarInModal();
        });
    });
}

function updateSelectedAvatarInModal() {
    // Update selection in modal
    elements.avatarOptions.querySelectorAll('.avatar-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    if (state.selectedAvatar && state.selectedAvatar.type === 'color') {
        const selectedOption = elements.avatarOptions.querySelector(`[data-index="${state.avatarOptions.findIndex(opt => opt.color === state.selectedAvatar.color)}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    }
}

function updateProfileUI(profile) {
    // User info
    const firstName = profile.first_name || 'Не указано';
    const lastName = profile.last_name || 'Не указано';
    const email = profile.email || 'Не указано';
    const role = profile.role === 'student' ? 'Студент' : 'Преподаватель';
    
    // Avatar
    updateAvatarUI();
    
    // User info
    elements.userName.textContent = `${firstName} ${lastName}`;
    elements.userEmail.textContent = email;
    elements.userEmailValue.textContent = email;
    elements.userFirstName.textContent = firstName;
    elements.userLastName.textContent = lastName;
    elements.userRole.textContent = role;
    
    // Study info
    updateStudyInfoUI(profile);
}

function updateAvatarUI() {
    const profile = state.profile;
    
    if (profile.avatar_url) {
        // If custom avatar image exists
        elements.userAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" class="avatar-image">`;
    } else if (profile.avatar_color) {
        // If color avatar exists
        elements.userAvatar.innerHTML = profile.avatar_text || 'ИП';
        elements.userAvatar.style.background = profile.avatar_color;
    } else {
        // Default avatar based on name
        const firstName = profile.first_name || 'И';
        const lastName = profile.last_name || 'П';
        const avatarText = (firstName[0] || '') + (lastName[0] || '');
        elements.userAvatar.innerHTML = avatarText;
        elements.userAvatar.style.background = '#3b82f6'; // Default blue
    }
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

function updateTestsUI(tests) {
    elements.testsCount.textContent = `${tests.length} тест${getRussianPlural(tests.length)}`;
    
    if (tests.length === 0) {
        showEmptyTests();
        return;
    }
    
    // Hide loading and empty states
    elements.testsLoading.style.display = 'none';
    elements.emptyTests.style.display = 'none';
    
    // Create test cards
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

function handleStartTest(testId) {
    sendMessageToParent({
        type: 'START_TEST_REQUEST',
        data: { testId }
    });
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