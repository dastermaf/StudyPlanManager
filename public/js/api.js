import { state } from './app.js';

const apiFetch = async (endpoint, options = {}) => {
    const defaultHeaders = { 'Content-Type': 'application/json' };
    if (state.userToken) {
        defaultHeaders['Authorization'] = `Bearer ${state.userToken}`;
    }
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };
    const response = await fetch(`/api${endpoint}`, config);
    const responseData = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(responseData.error || `HTTP error! status: ${response.status}`);
    }
    return responseData;
};

export const loginUser = (username, password) => apiFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
});

export const registerUser = (username, password, deviceId) => apiFetch('/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, deviceId }),
});

export const loadProgress = () => apiFetch('/progress');

export const saveProgress = (data) => apiFetch('/progress', {
    method: 'POST',
    body: JSON.stringify({ progressData: data }),
});
