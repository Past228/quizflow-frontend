// State management
let state = {
    loading: false
};

// DOM Elements
const elements = {
    loginPanel: document.getElementById('loginPanel'),
    resetPanel: document.getElementById('resetPanel'),
    messageContainer: document.getElementById('messageContainer'),
    resetMessageContainer: document.getElementById('resetMessageContainer'),
    loginForm: document.getElementById('loginForm'),
    resetRequestForm: document.getElementById('resetRequestForm'),
    submitBtn: document.getElementById('submitBtn'),
    toggleAuthBtn: document.getElementById('toggleAuthBtn'),
    signupBtn: document.getElementById('signupBtn'),
    forgotPasswordBtn: document.getElementById('forgotPasswordBtn'),
    backToLoginBtn: document.getElementById('backToLoginBtn'),

    // Input fields
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    resetEmail: document.getElementById('resetEmail'),

    // Error displays
    emailError: document.getElementById('emailError'),
    passwordError: document.getElementById('passwordError'),
    resetEmailError: document.getElementById('resetEmailError')
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function isResetPanelVisible() {
    return elements.resetPanel && !elements.resetPanel.classList.contains('auth-panel-hidden');
}

function showLoginPanel() {
    elements.loginPanel.classList.remove('auth-panel-hidden');
    elements.resetPanel.classList.add('auth-panel-hidden');
    elements.resetMessageContainer.innerHTML = '';
    displayValidationErrors({});
}

function showResetPanel() {
    elements.loginPanel.classList.add('auth-panel-hidden');
    elements.resetPanel.classList.remove('auth-panel-hidden');
    elements.messageContainer.innerHTML = '';
    displayValidationErrors({});
    if (elements.resetEmail) elements.resetEmail.focus();
}

function initializeEventListeners() {
    // Form submission
    elements.loginForm.addEventListener('submit', handleFormSubmit);
    elements.resetRequestForm.addEventListener('submit', handleResetRequestSubmit);

    // Toggle to signup
    elements.toggleAuthBtn.addEventListener('click', handleToggleToSignup);
    elements.signupBtn.addEventListener('click', handleSignupClick);
    elements.forgotPasswordBtn.addEventListener('click', function () {
        showResetPanel();
    });
    elements.backToLoginBtn.addEventListener('click', function () {
        showLoginPanel();
    });
}

// Communication with React parent
function sendMessageToParent(message) {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(message, window.location.origin);
    }
}

function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Message handlers from React
window.addEventListener('message', function(event) {
    if (event.origin !== window.location.origin) return;
    if (event.data == null || typeof event.data !== 'object') return;

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
            if (isResetPanelVisible()) {
                showResetMessage(data.message, 'error');
            } else {
                showMessage(data.message, 'error');
            }
            break;

        case 'PASSWORD_RESET_SENT':
            showResetMessage(data.message, 'success');
            elements.resetRequestForm.reset();
            break;
    }
});

// Event Handlers
function handleFormSubmit(e) {
    e.preventDefault();

    const formData = {
        email: elements.email.value,
        password: elements.password.value,
        isSignUp: false
    };

    sendMessageToParent({
        type: 'LOGIN_FORM_SUBMIT',
        data: formData
    });
}

function handleResetRequestSubmit(e) {
    e.preventDefault();
    elements.resetMessageContainer.innerHTML = '';
    displayValidationErrors({});

    sendMessageToParent({
        type: 'PASSWORD_RESET_REQUEST',
        data: { email: elements.resetEmail.value }
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
    var cls = type === 'success' ? 'success' : 'error';
    elements.messageContainer.innerHTML = `
        <div class="message ${cls}">
            ${escapeHtml(message)}
        </div>
    `;
}

function showResetMessage(message, type) {
    var cls = type === 'success' ? 'success' : 'error';
    elements.resetMessageContainer.innerHTML = `
        <div class="message ${cls}">
            ${escapeHtml(message)}
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
