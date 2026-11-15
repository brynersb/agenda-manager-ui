# Imagem da UI para o modo demonstração (T14a).
#
# As variáveis VITE_* são lidas em tempo de BUILD (o Vite as grava no bundle),
# por isso entram por ARG. Para outro ambiente, é preciso buildar de novo.
ARG NODE_VERSION=26.13.1

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
ENV CI=true

COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

COPY . .

ARG VITE_API_BASE_URL
ARG VITE_UI_THEME
ARG VITE_FORM_PRESENTATION
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_UI_THEME=$VITE_UI_THEME \
    VITE_FORM_PRESENTATION=$VITE_FORM_PRESENTATION

RUN npm run build

FROM nginx:alpine AS production

# A imagem oficial do nginx aplica `envsubst` nos arquivos de
# /etc/nginx/templates/*.template e grava o resultado em /etc/nginx/conf.d/.
# Só as variáveis de ambiente definidas são trocadas; `$uri` e afins ficam.
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Origens extras liberadas no `connect-src` da CSP (a API, que o navegador
# chama direto). O compose da demonstração sobrescreve este valor.
ENV CSP_CONNECT_SRC="http://localhost:3001"

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
