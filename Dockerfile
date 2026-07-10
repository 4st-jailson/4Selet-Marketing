# Painel 4Selet — imagem de producao
# Base do Playwright: ja traz Chromium + libs de sistema + fontes
FROM mcr.microsoft.com/playwright:v1.60.0-jammy
WORKDIR /app

# deps da raiz (Playwright, Remotion, React) e do painel (Express)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY interface/package*.json ./interface/
RUN cd interface && npm install --omit=dev --no-audit --no-fund

# codigo do projeto
COPY . .

# Remotion: garantir o Chrome Headless Shell para render de video
RUN npx remotion browser ensure || echo "validar Remotion no runtime"

ENV NODE_ENV=production HOST=0.0.0.0 PORT=4500
WORKDIR /app/interface
EXPOSE 4500
CMD ["node", "server.js"]
