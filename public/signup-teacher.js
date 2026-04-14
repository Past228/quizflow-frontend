let state = {
    loading: false,
    buildings: [],
    buildingsLoaded: false
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
    initializeEventListeners();
    initializeCodeValidation();
    
    // Загружаем корпуса при загрузке страницы
    sendMessageToParent({ type: 'LOAD_BUILDINGS_REQUEST' });
    
    // Принудительно включаем select через 3 секунды на всякий случай
    setTimeout(() => {
        if (elements.building && elements.building.disabled) {
            elements.building.disabled = false;
        }
    }, 3000);
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

// Проверка кода в реальном времени при вводе
function initializeCodeValidation() {
    const inviteCodeInput = elements.inviteCode;
    const inviteCodeError = elements.inviteCodeError;
    
    let validationTimeout;
    
    inviteCodeInput.addEventListener('input', function() {
        this.value = this.value.toUpperCase();
        
        // Очищаем предыдущий таймаут
        clearTimeout(validationTimeout);
        
        // Очищаем сообщение об ошибке при новом вводе
        inviteCodeError.textContent = '';
        inviteCodeError.style.color = '';
        
        // Ждем завершения ввода (минимум 3 символа)
        if (this.value.length >= 3) {
            validationTimeout = setTimeout(() => {
                validateInviteCode(this.value);
            }, 800);
        }
    });
}

function validateInviteCode(code) {
    if (!code || code.length < 3) {
        return;
    }
    
    sendMessageToParent({
        type: 'VALIDATE_INVITE_CODE',
        data: { code: code.toUpperCase() }
    });
}

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
            showMessage(data.message, 'error');
            break;
            
        case 'BUILDINGS_LOADED':
            handleBuildingsLoaded(data.buildings);
            break;
            
        case 'LOAD_ERROR':
            handleLoadError(data);
            break;
            
        case 'INVITE_CODE_VALIDATION_RESULT':
            handleInviteCodeValidationResult(data);
            break;
            
        case 'LOADING_STATE':
            handleLoadingState(data.loading, data.resource);
            break;
            
        default:
            break;
    }
});

function handleBuildingsLoaded(buildings) {
    state.buildings = buildings || [];
    state.buildingsLoaded = true;
    
    populateBuildings(buildings);
}

function handleLoadError(data) {
    if (data.resource === 'buildings') {
        // Показываем статический список корпусов при ошибке
        const staticBuildings = [
            { id: 1, name: 'Главный корпус' },
            { id: 2, name: 'Корпус А' },
            { id: 3, name: 'Корпус Б' },
            { id: 4, name: 'Корпус В' },
            { id: 5, name: 'Корпус Г' }
        ];
        
        populateBuildings(staticBuildings);
        
        showMessage('Корпуса загружены в ограниченном режиме', 'error');
    }
}

function populateBuildings(buildings) {
    if (!elements.building) {
        return;
    }
    
    // Сохраняем текущее значение
    const currentValue = elements.building.value;
    
    // Очищаем select
    elements.building.innerHTML = '';
    
    // Добавляем опцию по умолчанию
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Выберите корпус (опционально)';
    elements.building.appendChild(defaultOption);
    
    // Добавляем корпуса
    if (buildings && buildings.length > 0) {
        buildings.forEach(building => {
            const option = document.createElement('option');
            option.value = building.id;
            option.textContent = building.name;
            elements.building.appendChild(option);
        });
        
        // Восстанавливаем предыдущее значение если нужно
        if (currentValue) {
            elements.building.value = currentValue;
        }
    } else {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Корпуса не найдены';
        elements.building.appendChild(emptyOption);
    }
    
    // ВАЖНО: Разблокируем select
    elements.building.disabled = false;
    elements.building.style.pointerEvents = 'auto';
    elements.building.style.opacity = '1';
}

function handleInviteCodeValidationResult(result) {
    const errorElement = elements.inviteCodeError;
    
    if (result.valid) {
        errorElement.textContent = result.message || '✅ Код действителен';
        errorElement.style.color = '#10b981';
    } else {
        errorElement.textContent = result.message || '❌ Неверный код';
        errorElement.style.color = '#dc2626';
    }
}

function handleLoadingState(loading, resource) {
    if (resource === 'buildings') {
        if (loading) {
            // Показываем загрузку
            elements.building.innerHTML = '<option value="">Загрузка корпусов...</option>';
            elements.building.disabled = true;
        } else {
            // Когда загрузка завершена, разблокируем
            elements.building.disabled = false;
            
            // Если здания еще не загружены, покажем сообщение
            if (!state.buildingsLoaded) {
                elements.building.innerHTML = '<option value="">Ошибка загрузки корпусов</option>';
            }
        }
    }
}

function handleFormSubmit(e) {
    e.preventDefault();

    // Очищаем предыдущие сообщения
    elements.messageContainer.innerHTML = '';
    displayValidationErrors({});
    
    const formData = {
        email: elements.email.value,
        password: elements.password.value,
        firstName: elements.firstName.value,
        lastName: elements.lastName.value,
        buildingId: elements.building.value,
        inviteCode: elements.inviteCode.value,
    };

    // Валидация на клиенте
    const errors = validateFormClient(formData);
    if (Object.keys(errors).length > 0) {
        displayValidationErrors(errors);
        return;
    }
    
    sendMessageToParent({
        type: 'TEACHER_SIGNUP_FORM_SUBMIT',
        data: formData
    });
}

function validateFormClient(formData) {
    const errors = {};
    
    if (!formData.email) {
        errors.email = 'Email обязателен';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        errors.email = 'Некорректный формат email';
    }
    
    if (!formData.password) {
        errors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
        errors.password = 'Пароль должен быть не менее 6 символов';
    }
    
    if (!formData.firstName) {
        errors.firstName = 'Имя обязательно';
    }
    
    if (!formData.lastName) {
        errors.lastName = 'Фамилия обязательна';
    }
    
    if (!formData.inviteCode) {
        errors.inviteCode = 'Пригласительный код обязателен';
    }
    
    return errors;
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

function showMessage(message, type) {
    var cls = type === 'success' ? 'success' : 'error';
    elements.messageContainer.innerHTML = `
        <div class="message ${cls}">
            ${escapeHtml(message)}
        </div>
    `;

    elements.messageContainer.scrollIntoView({ behavior: 'smooth' });
}

function displayValidationErrors(errors) {
    // Очищаем все ошибки
    Object.values(elements).forEach(element => {
        if (element && element.classList && element.classList.contains('error-text')) {
            element.textContent = '';
            element.style.color = '';
        }
    });
    
    // Устанавливаем новые ошибки
    Object.entries(errors).forEach(([field, error]) => {
        const errorElement = elements[`${field}Error`];
        if (errorElement) {
            errorElement.textContent = error;
            errorElement.style.color = '#dc2626';
        }
    });
}

function resetForm() {
    elements.authForm.reset();
    elements.messageContainer.innerHTML = '';
    displayValidationErrors({});
    
    // Очищаем сообщение о проверке кода
    elements.inviteCodeError.textContent = '';
    elements.inviteCodeError.style.color = '';
    
    // Сбрасываем select корпусов к значению по умолчанию
    if (elements.building) {
        elements.building.value = '';
    }
}