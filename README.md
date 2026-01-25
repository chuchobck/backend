# 🍷 BARBOX - Backend API

API REST para sistema de gestión de licorería.

## 🚀 Instalación

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

## 📦 Producción

```bash
npm start
```

## 🔐 Variables de Entorno

```env
PORT=3000
DATABASE_URL="postgresql://user:pass@host:5432/db"
JWT_SECRET="tu_secreto_jwt"
NODE_ENV=production
```

## 📁 Estructura

```
src/
├── config/       # Configuraciones
├── controllers/  # Controladores
├── middleware/   # Middlewares
├── routes/       # Rutas API
└── lib/          # Prisma client

prisma/
├── schema.prisma # Esquema BD
└── migrations/   # Migraciones
```

## 🔗 Endpoints

- `/api/v1/auth` - Autenticación
- `/api/v1/productos` - Productos
- `/api/v1/clientes` - Clientes
- `/api/v1/facturas` - Facturas
- `/api/v1/categorias` - Categorías
- `/api/v1/marcas` - Marcas
- `/api/v1/promociones` - Promociones
