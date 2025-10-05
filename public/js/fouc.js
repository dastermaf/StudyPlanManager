// FOUC (Flash of Unstyled Content) を防ぐためのスクリプト
(function() {
    // DOMが読み込まれたらすぐにページコンテナを表示する
    document.addEventListener('DOMContentLoaded', function() {
        const container = document.getElementById('page-container');
        if (container) {
            container.style.opacity = '1';
        }
    });
})();