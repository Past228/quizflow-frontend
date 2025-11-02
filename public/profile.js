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
        { 
            id: 'male1',
            type: 'url', 
            url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face', 
            name: 'Мужчина 1' 
        },
        { 
            id: 'female1',
            type: 'url', 
            url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face', 
            name: 'Женщина 1' 
        },
        { 
            id: 'male2',
            type: 'url', 
            url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face', 
            name: 'Мужчина 2' 
        },
        { 
            id: 'female2',
            type: 'url', 
            url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face', 
            name: 'Женщина 2' 
        },
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
    elements.useUrlBtn.addEventListener('click', handleUseUrl);
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
        let avatarUrl = '';
        
        if (state.selectedAvatar.type === 'url') {
            avatarUrl = state.selectedAvatar.url;
        } else if (state.selectedAvatar.type === 'color') {
            // Для цветных аватарок создаем SVG
            avatarUrl = generateColorAvatarURL(state.selectedAvatar.color, state.selectedAvatar.text);
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
        alert('Аватар успешно обновлен!');
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
    elements.avatarUrlInput.value = '';
}

function populateAvatarOptions() {
    let optionsHTML = '';
    
    state.avatarOptions.forEach((option, index) => {
        const isSelected = state.selectedAvatar && state.selectedAvatar.id === option.id;
        
        if (option.type === 'url') {
            optionsHTML += `
                <div class="avatar-option ${isSelected ? 'selected' : ''}" 
                     data-id="${option.id}">
                    <img src="${option.url}" alt="${option.name}" class="avatar-option-image">
                </div>
            `;
        } else if (option.type === 'color') {
            optionsHTML += `
                <div class="avatar-option ${isSelected ? 'selected' : ''}" 
                     style="background: ${option.color}"
                     data-id="${option.id}">
                    <span class="avatar-option-initials">${option.text}</span>
                </div>
            `;
        }
    });
    
    elements.avatarOptions.innerHTML = optionsHTML;
    
    // Add event listeners to avatar options
    elements.avatarOptions.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', function() {
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
    // Update selection in modal
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
        // If avatar URL exists
        if (profile.avatar_url.startsWith('data:image/svg+xml')) {
            // If it's a generated SVG avatar
            elements.userAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" class="avatar-image">`;
        } else {
            // If it's a regular image URL
            const img = new Image();
            img.src = profile.avatar_url;
            img.className = 'avatar-image';
            img.onerror = function() {
                // If image fails to load, show default avatar
                showDefaultAvatar();
            };
            img.onload = function() {
                elements.userAvatar.innerHTML = '';
                elements.userAvatar.appendChild(img);
            };
            
            // Set timeout in case image takes too long to load
            setTimeout(() => {
                if (elements.userAvatar.children.length === 0) {
                    showDefaultAvatar();
                }
            }, 2000);
        }
    } else {
        showDefaultAvatar();
    }
}

function showDefaultAvatar() {
    const profile = state.profile;
    const firstName = profile.first_name || 'И';
    const lastName = profile.last_name || 'П';
    const avatarText = (firstName[0] || '') + (lastName[0] || '');
    elements.userAvatar.innerHTML = avatarText;
    elements.userAvatar.style.background = '#3b82f6';
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

function generateColorAvatarURL(color, text) {
    // Create SVG avatar
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