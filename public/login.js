// State management
let state = {
    loading: false
};

// DOM Elements
const elements = {
    messageContainer: document.getElementById('messageContainer'),
    loginForm: document.getElementById('loginForm'),
    submitBtn: document.getElementById('submitBtn'),
    toggleAuthBtn: document.getElementById('toggleAuthBtn'),
    signupBtn: document.getElementById('signupBtn'),
    
    // Input fields
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    
    // Error displays
    emailError: document.getElementById('emailError'),
    passwordError: document.getElementById('passwordError')
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Login HTML loaded');
    initializeEventListeners();
});

function initializeEventListeners() {
    // Form submission
    elements.loginForm.addEventListener('submit', handleFormSubmit);
    
    // Toggle to signup
    elements.toggleAuthBtn.addEventListener('click', handleToggleToSignup);
    elements.signupBtn.addEventListener('click', handleSignupClick);
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
            showMessage(data.message, 'success');
            resetForm();
            break;
            
        case 'AUTH_ERROR':
            showMessage(data.message, 'error');
            break;
    }
});

// Event Handlers
function handleFormSubmit(e) {
    e.preventDefault();
    console.log('Login form submitted');
    
    const formData = {
        email: elements.email.value,
        password: elements.password.value,
        isSignUp: false
    };
    
    console.log('Form data:', formData);
    
    sendMessageToParent({
        type: 'LOGIN_FORM_SUBMIT',
        data: formData
    });
}

function handleToggleToSignup() {
    sendMessageToParent({
        type: 'SWITCH_TO_SIGNUP'
    });
}

function handleSignupClick() {
    sendMessageToParent({
        type: 'SWITCH_TO_SIGNUP'
    });
}

// UI Updates
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
    elements.loginForm.reset();
    elements.messageContainer.innerHTML = '';
    
    // Clear errors
    displayValidationErrors({});
}