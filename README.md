### Backend
https://recetas-faciles.onrender.com

### Frontend
https://recetas-faciles-eight.vercel.app/

## Instalación y Ejecución

Para que la aplicación funcione correctamente, sigue los siguientes pasos:

### 0. Correr con los links.
Primero ejecutar el backend, esperar un tiempo para que la carga este completa. En la barra añadir api/health para ver si esta funcionando.
Segundo ejecutar el frontend un vez el paso anterior este completo.

Es posible que la app no responda a la primera, si eso sucede cambiar entre la seccion de generar nueva receta y ver recetas guardadas, es muy posible que encuentre la que genero de las primeras. Si no recargue la pagina y vuelva a intentar generar una receta.

### Para casos puntuales es posible que la app en local deje de funcionar

### 1. Instalar dependencias

Asegúrate de tener Node.js y npm instalados en tu sistema. Luego, navega hasta el directorio raíz del proyecto (`recetas`) e instala las dependencias:

```bash
npm install
```

### 2. Configuración de Firebase Admin SDK

La aplicación utiliza Firebase Admin SDK para interactuar con Firestore. Necesitarás un archivo de clave de cuenta de servicio de Firebase. Coloca este archivo JSON en el directorio raíz del proyecto y asegúrate de que el nombre del archivo sea `recetas-con-lo-que-tengas-firebase-adminsdk-fbsvc-3101b7e847.json` o actualiza `server.js` para que apunte al nombre correcto de tu archivo.

### 3. Variables de Entorno

Crea un archivo `.env` en el directorio raíz del proyecto con las siguientes variables de entorno:

```
GEMINI_API_KEY=TU_API_KEY_DE_GEMINI
```

Reemplaza `TU_API_KEY_DE_GEMINI` con tu clave de API de Google Gemini.

### 4. Iniciar la Aplicación

Una vez que todas las dependencias estén instaladas y la configuración de Firebase y las variables de entorno estén listas, puedes iniciar la aplicación. Desde el directorio raíz del proyecto, ejecuta:

```bash
npm start
```

Esto iniciará tanto el servidor backend (Node.js) como la aplicación frontend (React). La aplicación React se abrirá automáticamente en tu navegador en `http://localhost:3000` y el servidor backend estará escuchando en `http://localhost:5000`.
