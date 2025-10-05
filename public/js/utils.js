// --- ユーティリティ：数値のアニメーション ---
export function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentValue = Math.floor(progress * (end - start) + start);
        if (obj.textContent.includes('%')) {
            obj.textContent = `${currentValue.toFixed(1)}%`;
        } else {
            obj.textContent = currentValue;
        }
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// --- ユーティリティ：紙吹雪の作成 ---
export function triggerConfetti() {
    const container = document.getElementById('confetti-container') || document.createElement('div');
    if (!container.id) {
        container.id = 'confetti-container';
        container.className = 'confetti-container';
        document.body.appendChild(container);
    }

    container.innerHTML = '';
    const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6'];

    for (let i = 0; i < 150; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        const side = Math.random() > 0.5 ? 'left' : 'right';
        if (side === 'left') {
            particle.style.left = `${Math.random() * 25}%`;
        } else {
            particle.style.left = `${75 + Math.random() * 25}%`;
        }

        particle.style.animationDelay = `${Math.random() * 2}s`;
        particle.style.transform = `scale(${Math.random() * 0.75 + 0.5})`;
        container.appendChild(particle);
    }

    setTimeout(() => container.innerHTML = '', 3000);
}

// --- ユーティリティ：ページ遷移 ---
let pageTransitionOverlay;

function ensureOverlay() {
    if (!pageTransitionOverlay) {
        pageTransitionOverlay = document.createElement('div');
        pageTransitionOverlay.id = 'page-transition-overlay';
        pageTransitionOverlay.className = 'page-transition-overlay';
        document.body.appendChild(pageTransitionOverlay);
    }
}

// --- 変更：fadeOutPageを単純なナビゲーションに置き換え ---
export function fadeOutPage(url) {
    // アニメーションを削除し、直接ページ遷移を実行する
    window.location.href = url;
}

export function fadeInPage() {
    ensureOverlay();
    setTimeout(() => {
        pageTransitionOverlay.classList.remove('fade-in');
    }, 100);
}