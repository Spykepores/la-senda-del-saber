# La Senda del Saber - Guia Completa

## PARTE 1: Ejecutar en LOCAL

### Requisitos
- Node.js 20+ y npm
- Git

### Pasos
```bash
# 1. Clonar
git clone https://github.com/Spykepores/la-senda-del-saber.git
cd la-senda-del-saber

# 2. Instalar dependencias
npm install

# 3. Crear archivo .env (copia y pega todo)
cat > .env << 'EOF'
DATABASE_URL=postgresql://neondb_owner:npg_TbxoQlNuc6n2@ep-quiet-paper-aj53ynhu-pooler.c-3.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
VITE_APP_ID=19e8bd8a-3e72-830b-8000-0000ab4dbccb
VITE_KIMI_AUTH_URL=https://auth.kimi.com
KIMI_AUTH_URL=https://auth.kimi.com
APP_ID=19e8bd8a-3e72-830b-8000-0000ab4dbccb
APP_SECRET=Jdj9W14BCjkAsLOARCtISWvoTUAlLYMy
OWNER_UNION_ID=d6pjqrhtoom2guvap6c0
EOF

# 4. Iniciar (frontend + backend + WebSocket)
npm run dev
```

Abre http://localhost:3000 en **dos navegadores diferentes**, registrate con emails distintos y prueba el chat y los desafios.

---

## PARTE 2: Deploy ONLINE (backend Node.js funcionando)

### Opcion A: Railway (Recomendada - Gratis)

1. Ve a https://railway.app y logueate con GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Selecciona `la-senda-del-saber`
4. Ve a **Variables** y agrega:
   - `DATABASE_URL` = tu URL de Neon Postgres
   - `APP_SECRET` = `Jdj9W14BCjkAsLOARCtISWvoTUAlLYMy`
   - `OWNER_UNION_ID` = `d6pjqrhtoom2guvap6c0`
5. Railway detecta automaticamente el Dockerfile y despliega
6. Te da una URL tipo `https://la-senda-del-saber.up.railway.app`
7. **El WebSocket funciona automaticamente** en el mismo dominio

### Opcion B: Render (Gratis)

1. Ve a https://render.com y logueate con GitHub
2. Click **"New +"** → **"Web Service"**
3. Conecta tu repo de GitHub
4. Configura:
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. En **Environment Variables** agrega las mismas variables que arriba
6. Click **"Create Web Service"**
7. Espera a que el build termine (2-3 minutos)
8. Tu app estara en `https://la-senda-del-saber.onrender.com`

### Opcion C: Fly.io (Gratis con limites)

```bash
# 1. Instalar Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. En la carpeta del proyecto
fly launch --name la-senda-del-saber

# 4. Configurar secretos
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set APP_SECRET="Jdj9W14BCjkAsLOARCtISWvoTUAlLYMy"
fly secrets set OWNER_UNION_ID="d6pjqrhtoom2guvap6c0"

# 5. Deploy
fly deploy
```

---

## Puertos que usa la app

| Puerto | Servicio | Cuando funciona |
|--------|----------|-----------------|
| 3000 | Frontend + API tRPC | Siempre |
| 3001 | WebSocket (chat y juegos en tiempo real) | Solo con backend Node.js online |

---

## IMPORTANTE: WebSocket solo funciona con backend online

- **Deploy estatico (solo frontend):** El chat funciona con "polling" HTTP cada 2 segundos. Los mensajes llegan con delay.
- **Backend Node.js online (Railway/Render/Fly):** El WebSocket funciona. Los mensajes son instantaneos. Los desafios online funcionan correctamente.

Para que TODO funcione perfecto (chat en tiempo real + desafios multijugador), **debes deployar el backend Node.js en Railway, Render o Fly.io**.
