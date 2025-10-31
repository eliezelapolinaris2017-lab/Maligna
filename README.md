# Inventario Corporativo (HTML + CSS + JS)

Sistema de inventario **100% front-end** listo para GitHub Pages.

## ✔ Incluye
- Login con PIN (localStorage)
- Productos / Categorías / Suplidores / Almacenes
- Compras, Ventas, Transferencias, Ajustes (Kardex)
- Stock por almacén y total, alertas de bajo inventario
- Importar/Exportar JSON, Exportar CSV
- Impresión de reportes (usa `Ctrl/Cmd + P`)

## 🚀 Uso
1. Sube estos archivos al repositorio (branch `main`).
2. Activa GitHub Pages (Settings → Pages → Source: `main`).
3. Abre la URL pública. En el primer uso, crea tu **PIN**.

## 🗂 Datos
Se guardan en `localStorage` bajo la clave `inv.db.v1`.
Para backup, usa **Exportar JSON**.

## 🔧 Personalización
- Cambia el nombre y logo en **Configuración**.
- Ajusta colores en `styles.css`.

## ⚠️ Notas
- Es una base sólida para producción estática.  
- Si necesitas multiusuario/real-time: conectar a **Firebase** o tu API.
