import { state } from './app.js';

// Эта соль должна быть статичной и одинаковой для всех пользователей
const SALT = "your-static-salt-for-all-users";
const ITERATIONS = 100000; // Рекомендуемое количество итераций для PBKDF2

/**
 * Генерирует ключ шифрования из пароля пользователя.
 * @param {string} password - Пароль пользователя.
 */
export async function initializeCrypto(password) {
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    state.encryptionKey = await window.crypto.subtle.deriveKey(
        {
            "name": "PBKDF2",
            salt: new TextEncoder().encode(SALT),
            iterations: ITERATIONS,
            hash: "SHA-256"
        },
        keyMaterial,
        { "name": "AES-GCM", "length": 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Шифрует данные с использованием ключа.
 * @param {object} data - Объект с данными для шифрования.
 * @returns {Promise<string>} - Зашифрованная строка в формате Base64.
 */
export async function encryptData(data) {
    if (!state.encryptionKey) throw new Error("Ключ шифрования не инициализирован.");
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Initialization Vector
    const encodedData = new TextEncoder().encode(JSON.stringify(data));

    const encryptedContent = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        state.encryptionKey,
        encodedData
    );

    // Объединяем IV и зашифрованные данные для хранения
    const fullMessage = new Uint8Array(iv.length + encryptedContent.byteLength);
    fullMessage.set(iv);
    fullMessage.set(new Uint8Array(encryptedContent), iv.length);

    return btoa(String.fromCharCode.apply(null, fullMessage)); // Конвертируем в Base64
}

/**
 * Расшифровывает данные с использованием ключа.
 * @param {string} encryptedBase64 - Зашифрованная строка в формате Base64.
 * @returns {Promise<object>} - Расшифрованный объект.
 */
export async function decryptData(encryptedBase64) {
    if (!state.encryptionKey) throw new Error("Ключ шифрования не инициализирован.");

    const fullMessage = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)));
    const iv = fullMessage.slice(0, 12);
    const encryptedContent = fullMessage.slice(12);

    const decryptedContent = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        state.encryptionKey,
        encryptedContent
    );

    return JSON.parse(new TextDecoder().decode(decryptedContent));
}
