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
    console.log('Teacher signup HTML loaded');
    initializeEventListeners();
    initializeCodeValidation();
    
    // Загружаем корпуса при загрузке страницы
    sendMessageToParent({ type: 'LOAD_BUILDINGS_REQUEST' });
    
    // Принудительно включаем select через 3 секунды на всякий случай
    setTimeout(() => {
        if (elements.building && elements.building.disabled) {
            console.log('Force enabling building select after timeout');
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
    
    console.log('Validating invite code:', code);
    
    sendMessageToParent({
        type: 'VALIDATE_INVITE_CODE',
        data: { code: code.toUpperCase() }
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
            console.log('BUILDINGS_LOADED received with data:', data);
            handleBuildingsLoaded(data.buildings);
            break;
            
        case 'LOAD_ERROR':
            console.error('LOAD_ERROR:', data);
            handleLoadError(data);
            break;
            
        case 'INVITE_CODE_VALIDATION_RESULT':
            handleInviteCodeValidationResult(data);
            break;
            
        case 'LOADING_STATE':
            console.log('LOADING_STATE:', data);
            handleLoadingState(data.loading, data.resource);
            break;
            
        default:
            console.log('Unknown message type:', type);
    }
});

function handleBuildingsLoaded(buildings) {
    console.log('Handling buildings loaded:', buildings);
    state.buildings = buildings || [];
    state.buildingsLoaded = true;
    
    populateBuildings(buildings);
}

function handleLoadError(data) {
    console.error('Load error:', data);
    
    if (data.resource === 'buildings') {
        // Показываем статический список корпусов при ошибке
        const staticBuildings = [
            { id: 1, name: 'Главный корпус' },
            { id: 2, name: 'Корпус А' },
            { id: 3, name: 'Корпус Б' },
            { id: 4, name: 'Корпус В' },
            { id: 5, name: 'Корпус Г' }
        ];
        
        console.log('Using static buildings due to error');
        populateBuildings(staticBuildings);
        
        showMessage('Корпуса загружены в ограниченном режиме', 'error');
    }
}

function populateBuildings(buildings) {
    console.log('Populating buildings with:', buildings);
    
    if (!elements.building) {
        console.error('Building select element not found!');
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
        
        console.log(`Successfully populated ${buildings.length} buildings`);
    } else {
        console.log('No buildings to populate');
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Корпуса не найдены';
        elements.building.appendChild(emptyOption);
    }
    
    // ВАЖНО: Разблокируем select
    elements.building.disabled = false;
    elements.building.style.pointerEvents = 'auto';
    elements.building.style.opacity = '1';
    
    console.log('Building select after population:', {
        disabled: elements.building.disabled,
        optionsLength: elements.building.options.length,
        value: elements.building.value
    });
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
    console.log(`Loading state: ${resource}, loading: ${loading}`);
    
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
    console.log('Teacher signup form submitted');
    
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
    
    console.log('Teacher form data:', formData);
    
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
    elements.messageContainer.innerHTML = `
        <div class="message ${type}">
            ${message}
        </div>
    `;
    
    // Прокрутка к сообщению
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
            element.style.color = '#dc2626';
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

// Добавляем глобальную функцию для отладки
window.debugBuildingSelect = function() {
    console.log('Building select debug info:', {
        element: elements.building,
        disabled: elements.building.disabled,
        options: elements.building.options,
        value: elements.building.value,
        buildings: state.buildings
    });
    
    // Принудительно включаем
    elements.building.disabled = false;
    console.log('Building select enabled manually');
};