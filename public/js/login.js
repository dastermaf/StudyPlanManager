import * as auth from './auth.js';

// Эта функция будет вызвана при успешном входе в систему.
// Она перенаправляет пользователя на главную страницу приложения.
function onLoginSuccess() {
    console.log("LOG: login.js: Успешный вход, перенаправление на /app");
    window.location.href = '/app';
}

// Эта функция не будет использоваться на странице входа, но необходима для init.
function onLogout() {
    console.log("LOG: login.js: onLogout вызвана (не должно происходить на этой странице).");
}

// Инициализация модуля аутентификации при загрузке страницы.
document.addEventListener('DOMContentLoaded', () => {
    console.log("LOG: login.js: Страница загружена, инициализация auth модуля.");
    auth.init(onLoginSuccess, onLogout);
});