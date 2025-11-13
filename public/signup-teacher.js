let state = {
    loading: false,
    buildings: []
};

const elements = {
    messageContainer: document.getElementById('messageContainer'),
    authForm: document.getElementById('authForm'),
    submitBtn: document.getElementById('submitBtn'),
    toggleToStudentBtn: document.getElementById('toggleToStudentBtn'),
    loginBtn: document.getElementById('loginBtn'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    firstName: document.getElementById('firstName'),
    lastName: document.getElementById('lastName'),
    building: document.getElementById('building'),
    inviteCode: document.getElementById('inviteCode'),
    emailError: document.getElementById('emailError'),
    passwordError: document.getElementById('passwordError'),
    firstNameError: document.getElementById('firstNameError'),
    lastNameError: document.getElementById('lastNameError'),
    inviteCodeError: document.getElementById('inviteCodeError')
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('Teacher signup HTML loaded');
    initializeEventListeners();
    sendMessageToParent({ type: 'LOAD_BUILDINGS_REQUEST' });
});

function initializeEventListeners() {
    elements.authForm.addEventListener('submit', handleFormSubmit);
    elements.toggleToStudentBtn.addEventListener('click', handleToggleToStudent);
    elements.loginBtn.addEventListener('click', handleLoginClick);
    
    // Автоматическое приведение кода к верхнему регистру
    elements.inviteCode.addEventListener('input', function() {
        this.value = this.value.toUpperCase();
    });
}

function sendMessageToParent(message) {
    console.log('Sending message to parent:', message);
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(message, '*');
    }
}

window.addEventListener('message', function(event) {
    console.log('Received message from parent:', event.data);
    
    const { type, data } = event.data;
    
    switch (type) {
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
            
        case 'BUILDINGS_LOADED':
            populateBuildings(data.buildings);
            break;
            
        case 'LOAD_ERROR':
            showMessage(`Ошибка загрузки корпусов: ${data.message}`, 'error');
            break;
    }
});

function handleFormSubmit(e) {
    e.preventDefault();
    console.log('Teacher signup form submitted');
    
    const formData = {
        email: elements.email.value,
        password: elements.password.value,
        firstName: elements.firstName.value,
        lastName: elements.lastName.value,
        buildingId: elements.building.value,
        inviteCode: elements.inviteCode.value,
        role: 'teacher'
    };
    
    console.log('Teacher form data:', formData);
    
    sendMessageToParent({
        type: 'TEACHER_SIGNUP_FORM_SUBMIT',
        data: formData
    });
}

function handleToggleToStudent() {
    sendMessageToParent({
        type: 'SWITCH_TO_SIGNUP'
    });
}

function handleLoginClick() {
    sendMessageToParent({
        type: 'SWITCH_TO_LOGIN'
    });
}

function populateBuildings(buildings) {
    state.buildings = buildings;
    
    buildings.forEach(building => {
        const option = document.createElement('option');
        option.value = building.id;
        option.textContent = building.name;
        elements.building.appendChild(option);
    });
}

function showMessage(message, type) {
    elements.messageContainer.innerHTML = `
        <div class="message ${type}">
            ${message}
        </div>
    `;
}

function displayValidationErrors(errors) {
    Object.values(elements).forEach(element => {
        if (element && element.classList && element.classList.contains('error-text')) {
            element.textContent = '';
        }
    });
    
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
    displayValidationErrors({});
}