/** @type {import('tailwindcss').Config} */
module.exports = {
    // Указываем Tailwind, на какие файлы смотреть для применения стилей
    content: [
        './public/layout/**/*.html',
        './public/js/**/*.js',
    ],
    // ВКЛЮЧАЕМ ТЁМНУЮ ТЕМУ
    // Теперь Tailwind будет применять dark: стили, когда у <html> есть класс 'dark'
    darkMode: 'class',
    theme: {
        extend: {},
    },
    plugins: [],
}