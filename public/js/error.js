// エラーページ用スクリプト（日本語）
function getParam(name){
  const p = new URLSearchParams(location.search); return p.get(name) || '';
}
function mapCodeToMessage(code){
  const msgParam = decodeURIComponent(getParam('msg') || '');
  switch(code){
    case 'DB_DOWN':
      return msgParam || 'データベースに接続できません。しばらくしてから再試行してください。';
    case 'PROGRESS_LOAD_FAILED':
      return '進捗データの読み込みに失敗しました。時間をおいて再試行してください。';
    case 'DATA_INITIALIZED':
      return '初期データが作成されました。操作を続けられます。';
    case 'UNAUTHORIZED':
      return 'ログインが必要です。ログインし直してください。';
    case 'GENERIC':
      return msgParam || '不明なエラーが発生しました。';
    default:
      return msgParam || '不明なエラーが発生しました。';
  }
}
function initialize(){
  const code = getParam('code');
  const el = document.getElementById('error-message');
  if (el) el.textContent = mapCodeToMessage(code);
  const retry = document.getElementById('retry-btn');
  if (retry){
    retry.addEventListener('click', () => {
      const back = document.referrer || '/app';
      location.href = back;
    });
  }
}

document.addEventListener('DOMContentLoaded', initialize);
