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
    initializeCodeValidation();
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
    
    // Проверка при потере фокуса
    inviteCodeInput.addEventListener('blur', function() {
        if (this.value.length >= 3) {
            validateInviteCode(this.value);
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
            populateBuildings(data.buildings);
            break;
            
        case 'LOAD_ERROR':
            showMessage(`Ошибка загрузки корпусов: ${data.message}`, 'error');
            break;
            
        case 'INVITE_CODE_VALIDATION_RESULT':
            handleInviteCodeValidationResult(data);
            break;
            
        case 'LOADING_STATE':
            handleLoadingState(data.loading, data.resource);
            break;
    }
});

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
        const buildingSelect = elements.building;
        if (loading) {
            buildingSelect.innerHTML = '<option value="">Загрузка корпусов...</option>';
            buildingSelect.disabled = true;
        } else {
            buildingSelect.disabled = false;
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

function populateBuildings(buildings) {
    state.buildings = buildings;
    
    // Очищаем select
    elements.building.innerHTML = '<option value="">Выберите корпус (опционально)</option>';
    
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
}

// Функции для администратора (добавьте в отдельный файл admin.js или в этот, если нужно)
// Эти функции вызываются из административной панели

/**
 * Функция для администратора чтобы посмотреть использованные коды
 * @returns {Promise<Array>} Массив с информацией о кодах
 */
async function getInviteCodesStats() {
    try {
        const response = await fetch('/api/invite-codes/stats', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при получении статистики кодов');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting invite codes stats:', error);
        throw error;
    }
}

/**
 * Функция для создания нового пригласительного кода
 * @param {number} expiresInDays - Срок действия в днях
 * @returns {Promise<Object>} Созданный код
 */
async function createInviteCode(expiresInDays = 30) {
    try {
        const response = await fetch('/api/invite-codes/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                expiresInDays: expiresInDays
            })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при создании кода');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error creating invite code:', error);
        throw error;
    }
}

/**
 * Функция для получения детальной информации о конкретном коде
 * @param {string} code - Код для проверки
 * @returns {Promise<Object>} Информация о коде
 */
async function getInviteCodeDetails(code) {
    try {
        const response = await fetch(`/api/invite-codes/${code}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при получении информации о коде');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting invite code details:', error);
        throw error;
    }
}

// Пример использования функций администратора (в консоли или административной панели)
/*
// Получить статистику всех кодов
getInviteCodesStats().then(stats => {
    console.log('Статистика кодов:', stats);
});

// Создать новый код
createInviteCode(60).then(newCode => {
    console.log('Новый код создан:', newCode);
});

// Получить информацию о конкретном коде
getInviteCodeDetails('ABC12345').then(details => {
    console.log('Детали кода:', details);
});
*/