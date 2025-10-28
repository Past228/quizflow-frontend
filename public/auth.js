// State management
let state = {
    isSignUp: true,
    loading: false,
    buildings: [],
    courses: [],
    groups: [],
    selectedBuilding: '',
    selectedCourse: '',
    selectedGroup: '',
    selectedGroupId: null,
    loadingStates: {
        buildings: false,
        courses: false,
        groups: false
    }
};

// DOM Elements
const elements = {
    formTitle: document.getElementById('formTitle'),
    messageContainer: document.getElementById('messageContainer'),
    authForm: document.getElementById('authForm'),
    personalInfoSection: document.getElementById('personalInfoSection'),
    groupSection: document.getElementById('groupSection'),
    submitBtn: document.getElementById('submitBtn'),
    toggleAuthBtn: document.getElementById('toggleAuthBtn'),
    loginBtn: document.getElementById('loginBtn'),
    
    // Input fields
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    firstName: document.getElementById('firstName'),
    lastName: document.getElementById('lastName'),
    
    // Group selects
    building: document.getElementById('building'),
    course: document.getElementById('course'),
    group: document.getElementById('group'),
    
    // Error displays
    emailError: document.getElementById('emailError'),
    passwordError: document.getElementById('passwordError'),
    firstNameError: document.getElementById('firstNameError'),
    lastNameError: document.getElementById('lastNameError'),
    groupError: document.getElementById('groupError'),
    
    // Success message
    groupSuccess: document.getElementById('groupSuccess'),
    
    // Debug info
    debugBuilding: document.getElementById('debugBuilding'),
    debugCourse: document.getElementById('debugCourse'),
    debugGroup: document.getElementById('debugGroup'),
    debugBuildingsCount: document.getElementById('debugBuildingsCount'),
    debugCoursesCount: document.getElementById('debugCoursesCount'),
    debugGroupsCount: document.getElementById('debugGroupsCount'),
    debugLoading: document.getElementById('debugLoading')
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Auth HTML loaded');
    initializeEventListeners();
    updateUIForAuthMode();
    // Запрашиваем корпуса при загрузке
    sendMessageToParent({ type: 'LOAD_BUILDINGS_REQUEST' });
});

function initializeEventListeners() {
    // Form submission
    elements.authForm.addEventListener('submit', handleFormSubmit);
    
    // Toggle between sign up and sign in
    elements.toggleAuthBtn.addEventListener('click', handleToggleAuth);
    elements.loginBtn.addEventListener('click', handleLoginClick);
    
    // Group selection
    elements.building.addEventListener('change', handleBuildingChange);
    elements.course.addEventListener('change', handleCourseChange);
    elements.group.addEventListener('change', handleGroupChange);
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
        case 'SET_AUTH_MODE':
            state.isSignUp = data.isSignUp;
            updateUIForAuthMode();
            break;
            
        case 'VALIDATION_ERRORS':
            displayValidationErrors(data.errors);
            break;
            
        case 'AUTH_SUCCESS':
            showMessage(data.message, 'success');
            resetForm();
            break;
            
        case 'AUTH_ERROR':
            showMessage(data.message, 'error');
            break;
            
        case 'LOADING_STATE':
            setLoadingState(data.resource, data.loading);
            break;
            
        case 'BUILDINGS_LOADED':
            populateBuildings(data.buildings);
            break;
            
        case 'COURSES_LOADED':
            populateCourses(data.courses);
            break;
            
        case 'GROUPS_LOADED':
            populateGroups(data.groups);
            break;
            
        case 'LOAD_ERROR':
            showMessage(`Ошибка загрузки ${data.resource}: ${data.message}`, 'error');
            setLoadingState(data.resource, false);
            break;
    }
});

// Event Handlers
function handleFormSubmit(e) {
    e.preventDefault();
    console.log('Form submitted');
    
    const formData = {
        email: elements.email.value,
        password: elements.password.value,
        firstName: elements.firstName.value,
        lastName: elements.lastName.value,
        selectedGroupId: state.selectedGroupId,
        isSignUp: state.isSignUp
    };
    
    console.log('Form data:', formData);
    
    sendMessageToParent({
        type: 'AUTH_FORM_SUBMIT',
        data: formData
    });
}

function handleToggleAuth() {
    state.isSignUp = !state.isSignUp;
    updateUIForAuthMode();
    resetForm();
    
    sendMessageToParent({
        type: 'TOGGLE_AUTH',
        data: { isSignUp: state.isSignUp }
    });
}

function handleLoginClick() {
    state.isSignUp = false;
    updateUIForAuthMode();
    resetForm();
    
    sendMessageToParent({
        type: 'LOGIN_BUTTON_CLICK'
    });
}

function handleBuildingChange(e) {
    state.selectedBuilding = e.target.value;
    state.selectedCourse = '';
    state.selectedGroup = '';
    state.selectedGroupId = null;
    
    updateDebugInfo();
    updateGroupSuccess();
    
    if (state.selectedBuilding) {
        elements.course.disabled = false;
        elements.course.innerHTML = '<option value="">Загрузка курсов...</option>';
        
        sendMessageToParent({
            type: 'BUILDING_SELECTED',
            data: state.selectedBuilding
        });
    } else {
        elements.course.disabled = true;
        elements.course.innerHTML = '<option value="">Сначала выберите корпус</option>';
        elements.group.disabled = true;
        elements.group.innerHTML = '<option value="">Сначала выберите курс</option>';
    }
}

function handleCourseChange(e) {
    state.selectedCourse = e.target.value;
    state.selectedGroup = '';
    state.selectedGroupId = null;
    
    updateDebugInfo();
    updateGroupSuccess();
    
    if (state.selectedCourse) {
        elements.group.disabled = false;
        elements.group.innerHTML = '<option value="">Загрузка групп...</option>';
        
        sendMessageToParent({
            type: 'COURSE_SELECTED',
            data: state.selectedCourse
        });
    } else {
        elements.group.disabled = true;
        elements.group.innerHTML = '<option value="">Сначала выберите курс</option>';
    }
}

function handleGroupChange(e) {
    state.selectedGroup = e.target.value;
    state.selectedGroupId = e.target.value;
    
    updateDebugInfo();
    updateGroupSuccess();
    
    sendMessageToParent({
        type: 'GROUP_SELECTED',
        data: state.selectedGroupId
    });
}

// UI Updates
function updateUIForAuthMode() {
    if (state.isSignUp) {
        elements.formTitle.textContent = 'Регистрация';
        elements.submitBtn.textContent = 'Зарегистрироваться';
        elements.toggleAuthBtn.textContent = 'Уже есть аккаунт? Войти';
        elements.personalInfoSection.style.display = 'block';
        elements.groupSection.style.display = 'block';
    } else {
        elements.formTitle.textContent = 'Вход';
        elements.submitBtn.textContent = 'Войти';
        elements.toggleAuthBtn.textContent = 'Нет аккаунта? Зарегистрироваться';
        elements.personalInfoSection.style.display = 'none';
        elements.groupSection.style.display = 'none';
    }
}

function populateBuildings(buildings) {
    state.buildings = buildings;
    elements.building.innerHTML = '<option value="">Выберите корпус</option>';
    
    buildings.forEach(building => {
        const option = document.createElement('option');
        option.value = building.id;
        option.textContent = building.name;
        elements.building.appendChild(option);
    });
    
    updateDebugInfo();
}

function populateCourses(courses) {
    state.courses = courses;
    elements.course.innerHTML = '<option value="">Выберите курс</option>';
    
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `Курс ${course.course_number}`;
        elements.course.appendChild(option);
    });
    
    updateDebugInfo();
}

function populateGroups(groups) {
    state.groups = groups;
    elements.group.innerHTML = '<option value="">Выберите группу</option>';
    
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = `Группа ${group.group_number}`;
        elements.group.appendChild(option);
    });
    
    updateDebugInfo();
}

function setLoadingState(resource, loading) {
    state.loadingStates[resource] = loading;
    updateDebugInfo();
}

function showMessage(message, type) {
    elements.messageContainer.innerHTML = `
        <div class="message ${type}">
            ${message}
        </div>
    `;
}

function displayValidationErrors(errors) {
    // Clear previous errors
    Object.values(elements).forEach(element => {
        if (element && element.classList && element.classList.contains('error-text')) {
            element.textContent = '';
        }
    });
    
    // Display new errors
    Object.entries(errors).forEach(([field, error]) => {
        const errorElement = elements[`${field}Error`];
        if (errorElement) {
            errorElement.textContent = error;
        }
    });
}

function resetForm() {
    elements.authForm.reset();
    elements.messageContainer.innerHTML = '';
    
    // Clear errors
    displayValidationErrors({});
    
    // Reset group selection
    state.selectedBuilding = '';
    state.selectedCourse = '';
    state.selectedGroup = '';
    state.selectedGroupId = null;
    
    elements.building.value = '';
    elements.course.disabled = true;
    elements.course.innerHTML = '<option value="">Сначала выберите корпус</option>';
    elements.group.disabled = true;
    elements.group.innerHTML = '<option value="">Сначала выберите курс</option>';
    
    updateDebugInfo();
    updateGroupSuccess();
}

function updateGroupSuccess() {
    if (state.selectedGroupId) {
        elements.groupSuccess.style.display = 'block';
        elements.groupError.textContent = '';
    } else {
        elements.groupSuccess.style.display = 'none';
    }
}

function updateDebugInfo() {
    elements.debugBuilding.textContent = state.selectedBuilding || 'нет';
    elements.debugCourse.textContent = state.selectedCourse || 'нет';
    elements.debugGroup.textContent = state.selectedGroup || 'нет';
    elements.debugBuildingsCount.textContent = state.buildings.length;
    elements.debugCoursesCount.textContent = state.courses.length;
    elements.debugGroupsCount.textContent = state.groups.length;
    elements.debugLoading.textContent = JSON.stringify(state.loadingStates);
}