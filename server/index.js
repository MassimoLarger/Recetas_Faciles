require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ===== 🔐 Configuración Firebase =====
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = getFirestore();

// ===== 🤖 Configuración Gemini AI =====
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ===== 🚀 Configuración Express =====
const app = express();
const port = process.env.PORT || 5000;

// ===== 🛡️ Middlewares de Seguridad =====
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiter (100 requests por 15 minutos)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes desde esta IP'
});
app.use('/api/', limiter);

// ===== 📝 Funciones Auxiliares =====
function parseIngredients(input) {
  if (typeof input === 'string') {
    return input.split(',').map(item => item.trim()).filter(Boolean);
  }
  return Array.isArray(input) ? input : [];
}

function parseGeneratedText(text) {
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
}

// ===== 🌐 Endpoints =====

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// Generar Receta
app.post('/api/generate-recipe', async (req, res) => {
  try {
    const { ingredients, dietaryRestrictions = [], preferences = '' } = req.body;
    const validatedIngredients = parseIngredients(ingredients);

    if (validatedIngredients.length === 0) {
      return res.status(400).json({ error: 'Debes proporcionar ingredientes' });
    }

    const prompt = `Genera una receta con: ${validatedIngredients.join(', ')}.\n\nFormato:
    **Título:** [Nombre de la receta]
    **Ingredientes:**
    - [Ingrediente 1]
    **Instrucciones:**
    1. [Paso 1]`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const recipeData = parseGeneratedText(result.response.text());

    // Guardar en Firestore
    const recipeRef = db.collection('recetas').doc();
    await recipeRef.set({
      ...recipeData,
      originalIngredients: validatedIngredients,
      createdAt: FieldValue.serverTimestamp(),
      likes: 0
    });

    res.status(201).json({ id: recipeRef.id, ...recipeData });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al generar receta' });
  }
});

// Obtener Recetas
app.get('/api/recipes', async (req, res) => {
  try {
    const snapshot = await db.collection('recetas')
      .orderBy('createdAt', 'desc')
      .get();

    const recipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recetas' });
  }
});

// ===== ⚠️ Manejo de Errores =====
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ===== 🚪 Inicio del Servidor =====
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Firebase Project: ${process.env.FIREBASE_PROJECT_ID}`);
});