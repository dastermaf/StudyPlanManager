# 1. ベースとなるNode.jsの環境を選択します
FROM node:18-slim

# 2. アプリケーションの作業ディレクトリを作成します
WORKDIR /app

# 3. package.jsonとpackage-lock.jsonをコピーします
COPY package*.json ./

# 4. 依存関係のみを先にインストールします
# これにより、コードを変更した際にキャッシュが効き、ビルドが速くなります
RUN npm install

# 5. プロジェクトの全てのファイルを作業ディレクトリにコピーします
COPY . .

# 6. CSSファイルをビルドします
# この時点で input.css と tailwind.config.js が存在します
RUN npm run build:css

# 7. アプリケーションが使用するポートを公開します
EXPOSE 3000

# 8. サーバーを起動するコマンドを実行します
CMD [ "npm", "start" ]