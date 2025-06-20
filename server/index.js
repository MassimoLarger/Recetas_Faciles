import 'dotenv/config';
import express from 'express';
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ===== 🛡️ Configuración de Seguridad Inicial =====
const app = express();

// Middlewares esenciales
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiter (100 requests por 15 minutos)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// ===== 🔐 Configuración Firebase =====
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = getFirestore();

// ===== 🤖 Configuración Gemini AI =====
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",
  generationConfig: {
    temperature: 0.9,
    topP: 1
  }
});

// ===== 🌐 Configuración CORS Dinámica =====
const allowedOrigins = [
  "https://recetas-faciles-eta.vercel.app",
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

// ===== 📝 Funciones Auxiliares =====
const parseGeneratedText = (text) => {
  const result = {
    title: 'Receta Generada',
    ingredients: [],
    instructions: []
  };

  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  let currentSection = null;

  lines.forEach(line => {
    if (line.match(/^(\*\*)?Título:/i)) {
      result.title = line.replace(/^(\*\*)?Título:(\*\*)?/i, '').trim();
      currentSection = null;
    } 
    else if (line.match(/^(\*\*)?Ingredientes:/i)) {
      currentSection = 'ingredients';
    } 
    else if (line.match(/^(\*\*)?Instrucciones:/i)) {
      currentSection = 'instructions';
    }
    else if (currentSection === 'ingredients' && line.match(/^[-*]\s/)) {
      result.ingredients.push(line.replace(/^[-*]\s/, '').trim());
    }
    else if (currentSection === 'instructions' && line.match(/^\d+\./)) {
      result.instructions.push(line.replace(/^\d+\.\s*/, '').trim());
    }
  });

  return result;
};

// ===== 🚀 Endpoints =====

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Generar Receta
app.post('/api/generate-recipe', async (req, res) => {
  try {
    const { ingredients = [], dietaryRestrictions = [], preferences = '' } = req.body;

    // Validación de entrada
    const validatedIngredients = Array.isArray(ingredients) ? 
      ingredients.filter(Boolean) : 
      String(ingredients).split(',').map(item => item.trim()).filter(Boolean);

    if (validatedIngredients.length === 0) {
      return res.status(400).json({ error: 'Debes proporcionar ingredientes' });
    }

    const prompt = `Genera una receta con: ${validatedIngredients.join(', ')}.\n\nFormato:
    **Título:** [Nombre de la receta]
    **Ingredientes:**
    - [Ingrediente 1]
    **Instrucciones:**
    1. [Paso 1]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const recipeData = parseGeneratedText(text);

    // Firestore Transaction
    const newRecipe = await db.runTransaction(async (transaction) => {
      const counterRef = db.collection('contadores').doc('recetas');
      const counterDoc = await transaction.get(counterRef);
      const newId = (counterDoc.data()?.lastId || 0) + 1;

      const recipeRef = db.collection('recetas').doc(`receta${newId}`);
      const recipeToSave = {
        ...recipeData,
        id: newId,
        originalIngredients: validatedIngredients,
        createdAt: FieldValue.serverTimestamp(),
        likes: 0
      };

      transaction.set(recipeRef, recipeToSave);
      transaction.update(counterRef, { lastId: newId });

      return { id: newId, ...recipeToSave };
    });

    res.status(201).json(newRecipe);
  } catch (error) {
    console.error('Error en generate-recipe:', error);
    res.status(500).json({ 
      error: 'Error al generar receta',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// Obtener Recetas (con paginación)
app.get('/api/recipes', async (req, res) => {
  try {
    const { limit = 10, lastId } = req.query;
    const limitNum = Math.min(Number(limit), 50); // Máximo 50 por petición

    let query = db.collection('recetas')
      .orderBy('createdAt', 'desc')
      .limit(limitNum);

    if (lastId) {
      const lastDoc = await db.collection('recetas').doc(lastId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const recipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      data: recipes,
      hasMore: recipes.length === limitNum,
      lastId: recipes.length ? recipes[recipes.length - 1].id : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recetas' });
  }
});

// ===== ⚠️ Manejo de Errores =====
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

app.use((err, req, res, next) => {
  console.error('Error global:', err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ===== 🚪 Inicio del Servidor =====
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n🟢 Servidor escuchando en http://${HOST}:${PORT}`);
  console.log(`🔹 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔹 Firebase Project: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`🔹 Orígenes permitidos: ${allowedOrigins.join(', ')}\n`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});