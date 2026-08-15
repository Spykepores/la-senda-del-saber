# La Senda del Saber - Deploy en Render (GRATIS 24/7) 🚀

## ⚠️ PROBLEMA CON RAILWAY
Railway gratuito tiene restriccion de horas pico (8am-8pm PT).
**Render NO tiene esta restriccion y funciona 24/7 gratis.**

---

## PASO 1: Crear cuenta en Render

1. Ve a https://render.com
2. Click **"Get Started for Free"**
3. Registrate con tu email o GitHub
4. Verifica tu email

---

## PASO 2: Conectar tu repo de GitHub

1. En el dashboard de Render, click **"New +"** (boton azul arriba a la derecha)
2. Selecciona **"Web Service"**
3. Conecta tu cuenta de GitHub si no lo has hecho
4. Busca y selecciona el repo: **Spykepores/la-senda-del-saber**
5. Click **"Connect"**

---

## PASO 3: Configurar el servicio

Render detectara automaticamente el `render.yaml`. Configura asi:

| Campo | Valor |
|-------|-------|
| **Name** | la-senda-del-saber |
| **Runtime** | Node |
| **Region** | Oregon (US West) |
| **Branch** | main |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | Free |

---

## PASO 4: Agregar Variables de Entorno (IMPORTANTE)

Ve a la pestaña **"Environment"** y agrega estas variables:

### Variable 1: DATABASE_URL
```
DATABASE_URL=postgresql://neondb_owner:npg_TbxoQlNuc6n2@ep-quiet-paper-aj53ynhu-pooler.c-3.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

### Variable 2: APP_SECRET
```
APP_SECRET=Jdj9W14BCjkAsLOARCtISWvoTUAlLYMy
```

### Variable 3: OWNER_UNION_ID
```
OWNER_UNION_ID=d6pjqrhtoom2guvap6c0
```

### Variable 4: APP_ID
```
APP_ID=19e8bd8a-3e72-830b-8000-0000ab4dbccb
```

### Variable 5: NODE_ENV
```
NODE_ENV=production
```

---

## PASO 5: Deploy

1. Click en **"Create Web Service"** (abajo)
2. Render empezara a hacer build automaticamente
3. Espera 3-5 minutos (veras los logs en tiempo real)
4. Cuando diga **"Your service is live"**, copia la URL

Tu URL sera algo como:
```
https://la-senda-del-saber.onrender.com
```

---

## PASO 6: Configurar Dominio (Opcional)

Si quieres tu propio dominio:
1. Ve a **Settings** → **Custom Domains**
2. Agrega tu dominio (ej: `trivia-cristiana.com`)
3. Sigue las instrucciones de DNS que te da Render

---

## ✅ VERIFICAR QUE FUNCIONA

Abre tu URL en el navegador y verifica:

1. **Pagina principal carga** ✅
2. **Registro de usuarios** funciona ✅
3. **Chat Global** en tiempo real ✅
4. **Desafios 1v1** entre jugadores ✅
5. **Ruleta sincronizada** ✅

---

## 🔧 SOLUCION DE PROBLEMAS

### "Build failed"
- Ve a la pestaña **Logs**
- Busca el error especifico
- Asegurate de que las variables de entorno esten correctas

### "Cannot connect to database"
- Verifica que DATABASE_URL este copiada EXACTAMENTE como esta
- La URL incluye `sslmode=require` (necesario para Neon)

### "WebSocket not working"
- En Render, ve a **Settings** → **Health Check**
- El WebSocket funciona automaticamente en el mismo puerto HTTP (3000)

### El servicio se duerme (Free plan)
- Render Free "duerme" despues de 15 min sin uso
- El primer request despues de dormir tarda 30-60 segundos
- Esto es normal en el plan gratuito

---

## 📱 COMPARTIR CON AMIGOS

Una vez deployado, comparte tu URL para que otros jueguen contigo:

```
https://la-senda-del-saber.onrender.com
```

Cada jugador debe:
1. Registrarse con email
2. Ir a "Desafios"
3. Crear un desafio seleccionando un oponente
4. El oponente acepta y juegan en tiempo real

---

## 💰 SI QUIERES QUE NO SE DUERMA (Opcional)

El plan gratuito de Render "duerme" despues de 15 min sin usar.
Para mantenerlo activo 24/7:

1. Ve a **Settings** → **Plan**
2. Upgrade a **Starter** ($7/mes)
3. O usa un servicio de "ping" como UptimeRobot (gratis)

---

## 🎮 FUNCIONALIDADES DISPONIBLES

| Funcion | Estado |
|---------|--------|
| Jugar Solo | ✅ |
| Tabla de Records | ✅ |
| Registro/Login | ✅ |
| Chat Global en tiempo real | ✅ |
| Desafios 1v1 online | ✅ |
| Ruleta sincronizada | ✅ |
| Sala de chat por desafio | ✅ |
| Usuarios online | ✅ |
