# 1. ベースとなるNode.jsの環境を選択します
FROM node:18-slim

# 2. アプリケーションの作業ディレクトリを作成します
WORKDIR /app

# 3. package.jsonとpackage-lock.jsonをコピーします
# これにより、必要なライブラリだけを効率的にインストールできます
COPY package*.json ./

# 4. 必要なライブラリをインストールします
RUN npm install

# 5. プロジェクトの全てのファイルを作業ディレクトリにコピーします
COPY . .

# 6. アプリケーションが使用するポートを公開します
EXPOSE 3000

# 7. サーバーを起動するコマンドを実行します
CMD [ "npm", "start" ]

