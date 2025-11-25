// State management
let state = {
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
    submitBtn: document.getElementById('submitBtn'),
    toggleAuthBtn: document.getElementById('toggleAuthBtn'),
    toggleToTeacherBtn: document.getElementById('toggleToTeacherBtn'),
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
    groupSuccess: document.getElementById('groupSuccess')
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Signup HTML loaded');
    initializeEventListeners();
    // Запрашиваем корпуса при загрузке
    sendMessageToParent({ type: 'LOAD_BUILDINGS_REQUEST' });
});

function initializeEventListeners() {
    // Form submission
    elements.authForm.addEventListener('submit', handleFormSubmit);
    
    // Toggle to login
    elements.toggleAuthBtn.addEventListener('click', handleToggleToLogin);
    elements.loginBtn.addEventListener('click', handleLoginClick);
    
    // Toggle to teacher registration
    elements.toggleToTeacherBtn.addEventListener('click', handleToggleToTeacher);
    
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
        case 'VALIDATION_ERRORS':
            displayValidationErrors(data.errors);
            break;
            
        case 'AUTH_SUCCESS':
            // Показываем сообщение о необходимости подтверждения email
            showMessage(`
                <div class="message success">
                    <strong>Регистрация успешна! 🎉</strong><br><br>
                    📧 На вашу почту отправлено письмо с ссылкой для подтверждения.<br>
                    Пожалуйста, проверьте вашу электронную почту и перейдите по ссылке в письме.<br><br>
                    Через несколько секунд вы будете перенаправлены на страницу входа...
                </div>
            `, 'success');
            
            // Очищаем форму
            resetForm();
            
            // Автоматический переход на страницу входа через 3 секунды
            setTimeout(() => {
                handleToggleToLogin();
            }, 3000);
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
    console.log('Signup form submitted');
    
    const formData = {
        email: elements.email.value,
        password: elements.password.value,
        firstName: elements.firstName.value,
        lastName: elements.lastName.value,
        selectedGroupId: state.selectedGroupId,
        isSignUp: true
    };
    
    console.log('Form data:', formData);
    
    sendMessageToParent({
        type: 'SIGNUP_FORM_SUBMIT',
        data: formData
    });
}

function handleToggleToLogin() {
    sendMessageToParent({
        type: 'SWITCH_TO_LOGIN'
    });
}

function handleLoginClick() {
    sendMessageToParent({
        type: 'SWITCH_TO_LOGIN'
    });
}

function handleToggleToTeacher() {
    sendMessageToParent({
        type: 'SWITCH_TO_TEACHER_SIGNUP'
    });
}

function handleBuildingChange(e) {
    state.selectedBuilding = e.target.value;
    state.selectedCourse = '';
    state.selectedGroup = '';
    state.selectedGroupId = null;
    
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
    
    updateGroupSuccess();
    
    sendMessageToParent({
        type: 'GROUP_SELECTED',
        data: state.selectedGroupId
    });
}

// UI Updates
function populateBuildings(buildings) {
    state.buildings = buildings;
    elements.building.innerHTML = '<option value="">Выберите корпус</option>';
    
    buildings.forEach(building => {
        const option = document.createElement('option');
        option.value = building.id;
        option.textContent = building.name;
        elements.building.appendChild(option);
    });
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
}

function setLoadingState(resource, loading) {
    state.loadingStates[resource] = loading;
}

function showMessage(message, type) {
    if (typeof message === 'string' && message.includes('<div')) {
        // Если message уже содержит HTML, используем как есть
        elements.messageContainer.innerHTML = message;
    } else {
        // Стандартное сообщение
        elements.messageContainer.innerHTML = `
            <div class="message ${type}">
                ${message}
            </div>
        `;
    }
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