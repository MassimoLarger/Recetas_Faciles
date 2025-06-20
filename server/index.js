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

const corsOptions = {
  origin: [
    'https://tu-frontend.vercel.app',
    'http://localhost:3000' // para desarrollo
  ],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(helmet());
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
  let { ingredients, dietaryRestrictions, preferences } = req.body;

  // Ensure ingredients is an array
  if (typeof ingredients === 'string') {
    ingredients = ingredients.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }
  if (!Array.isArray(ingredients)) {
    ingredients = [];
  }

  // Ensure dietaryRestrictions is an array
  if (typeof dietaryRestrictions === 'string') {
    dietaryRestrictions = dietaryRestrictions.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }
  if (!Array.isArray(dietaryRestrictions)) {
    dietaryRestrictions = [];
  }

  // Ensure preferences is a string (or handle as array if needed later)
  if (typeof preferences !== 'string') {
    preferences = '';
  }

  try {
    const prompt = `Genera una receta con los siguientes ingredientes: ${ingredients}. El formato debe ser:

    Título: [Título de la receta]
    Ingredientes:
    * [Ingrediente 1]
    * [Ingrediente 2]
    Instrucciones:
    1. **[Paso 1]**
    2. **[Paso 2]**
    ...
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash"});
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();
    if (generatedText !== undefined && generatedText !== null && generatedText !== '') {
      console.log("Respuesta de la IA generada");
    }
    
    let title = "";
    let ingredientsList = [];
    let instructionsBuffer = [];
    if (!generatedText) {
      throw new Error('No se recibió contenido de la IA.');
    }

    const lines = generatedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let recipeIngredients = [];
    let instructions = 'No se pudieron extraer las instrucciones.';

    let currentSection = '';

    for (const line of lines) {
      if (line.startsWith('Título:') || line.startsWith('**Título:')) {
        title = line.replace(/\*\*Título:\*\*\s*/, '').replace('Título:', '').trim();
        currentSection = 'title';
      } else if (line.startsWith('Ingredientes:') || line.startsWith('**Ingredientes:')) {
        currentSection = 'ingredients';
      } else if (line.startsWith('Instrucciones:') || line.startsWith('**Instrucciones:')) {
        currentSection = 'instructions';
      } else if (currentSection === 'ingredients' && line.startsWith('*')) {
        ingredientsList.push(line.replace(/\*\s*/, '').trim());
      } else if (currentSection === 'instructions' && line.length > 0) {
        instructionsBuffer.push(line.trim());
      }
    } 

    if (instructionsBuffer.length > 0) {
      instructions = instructionsBuffer.join('\n');
    } else {
      instructions = "No se pudieron extraer las instrucciones.";
    }

    res.json({
      Nombre: title || 'Receta Generada',
      Ingredientes: ingredientsList,
      Instrucciones: instructions
    });

    const db = getFirestore();

    const counterRef = db.collection('contadores').doc('recetas');
    const counterDoc = await counterRef.get();
    let lastId = counterDoc.exists ? counterDoc.data().lastId : 0;

    lastId++;
    await counterRef.set({ lastId });

    const recipeRef = db.collection('recetas').doc(`receta${lastId}`);
    await recipeRef.set({
      Nombre: title || 'Receta Generada',
      Ingredientes: ingredientsList,
      Instrucciones: instructions,
      id: lastId
    })
    .then(() => {
      console.log("Receta enviada correctamente a Firestore");
    })
    .catch((error) => {
      console.error("Error al enviar la receta:", error);
    });
  } catch (error) {
    console.error('Error al generar la respuesta de la ia:', error);
    res.status(500).json({ error: 'Error al generar la receta.' });
  }
});

// Obtener Recetas
app.get('/api/recipes', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection('recetas').get();
    const recipes = [];
    
    snapshot.forEach(doc => {
      recipes.push({
        id: doc.id,
        ...doc.data()
      });
    });

    recipes.sort((a, b) => b.id - a.id);

    console.log("Recetas obtenidas correctamente");

    res.json(recipes);
  } catch (error) {
    console.error('Error al obtener recetas:', error);
    res.status(500).json({ error: 'Error al cargar recetas' });
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