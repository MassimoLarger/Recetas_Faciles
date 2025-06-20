import 'dotenv/config';
import express from 'express';
import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// 1. Configura primero el limiter correctamente
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Límite de peticiones excedido'
});

// ===== 🛡️ Configuración Inicial =====
const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// ===== 📝 Middlewares Mejorados =====
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/', limiter);

// ===== 🔐 Firebase Config =====
const firebaseConfig = {
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL
};

admin.initializeApp(firebaseConfig);
const db = getFirestore();

// ===== 🤖 Gemini AI Config =====
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",
  generationConfig: {
    temperature: 0.9,
    topP: 1
  }
});

// ===== 🌐 CORS Dinámico Mejorado =====
const allowedOrigins = [
  "https://recetas-faciles-eta.vercel.app",
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ===== 🚀 Endpoints Mejorados =====

// Health Check mejorado
app.get('/api/health', async (req, res) => {
  try {
    // Verifica conexión a Firestore
    await db.collection('health').doc('check').get();
    res.json({ 
      status: 'healthy',
      services: {
        firestore: 'connected',
        gemini: 'available'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy',
      error: 'Service unavailable',
      details: error.message 
    });
  }
});

// Generar Receta (con validación mejorada)
app.post('/api/generate-recipe', async (req, res) => {
  try {
    const { ingredients, dietaryRestrictions = [], preferences = '' } = req.body;

    // Validación mejorada
    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({ 
        error: 'Formato inválido: ingredients debe ser un array',
        example: { ingredients: ["pollo", "arroz"] }
      });
    }

    const prompt = `Genera una receta con: ${ingredients.join(', ')}.\n\nFormato:
    **Título:** [Nombre]
    **Ingredientes:**
    - [Ingrediente 1]
    **Instrucciones:**
    1. [Paso 1]`;

    const result = await model.generateContent(prompt);
    const recipeData = parseGeneratedText(result.response.text());

    // Firestore Transaction mejorada
    const newRecipe = await createRecipeInFirestore(recipeData, ingredients);
    
    res.status(201).json(newRecipe);
  } catch (error) {
    handleError(res, error, 'generate-recipe');
  }
});

// ===== 🔄 Funciones Auxiliares =====

async function createRecipeInFirestore(recipeData, ingredients) {
  const batch = db.batch();
  const counterRef = db.collection('counters').doc('recipes');
  const recipeRef = db.collection('recipes').doc();

  const newRecipe = {
    ...recipeData,
    id: recipeRef.id,
    originalIngredients: ingredients,
    createdAt: FieldValue.serverTimestamp(),
    likes: 0,
    status: 'published'
  };

  batch.set(recipeRef, newRecipe);
  batch.update(counterRef, { count: FieldValue.increment(1) });

  await batch.commit();
  return { id: recipeRef.id, ...newRecipe };
}

function handleError(res, error, context) {
  console.error(`[${new Date().toISOString()}] Error in ${context}:`, error);
  
  const statusCode = error.code === 'permission-denied' ? 403 : 500;
  const response = {
    error: 'Operation failed',
    requestId: res.locals.requestId
  };

  if (process.env.NODE_ENV === 'development') {
    response.details = {
      message: error.message,
      stack: error.stack
    };
  }

  res.status(statusCode).json(response);
}

// ===== ⚠️ Manejo de Errores Global =====
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint no encontrado',
    availableEndpoints: ['/api/health', '/api/generate-recipe', '/api/recipes']
  });
});

app.use((err, req, res, next) => {
  handleError(res, err, 'global-error-handler');
});

// ===== 🚪 Inicio del Servidor =====
app.listen(PORT, HOST, () => {
  console.log(`
  🚀 Servidor listo en http://${HOST}:${PORT}
  ⏱️  ${new Date().toLocaleString()}
  🔹 Entorno: ${process.env.NODE_ENV || 'development'}
  🔹 Firebase: ${process.env.FIREBASE_PROJECT_ID}
  🔹 Orígenes permitidos: ${allowedOrigins.join(', ')}
  `);
});