import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
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
}

const db = getFirestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let { ingredients, dietaryRestrictions, preferences } = req.body;

  // Limpieza
  if (typeof ingredients === 'string') ingredients = ingredients.split(',').map(i => i.trim());
  if (!Array.isArray(ingredients)) ingredients = [];

  if (typeof dietaryRestrictions === 'string') dietaryRestrictions = dietaryRestrictions.split(',').map(i => i.trim());
  if (!Array.isArray(dietaryRestrictions)) dietaryRestrictions = [];

  if (typeof preferences !== 'string') preferences = '';

  try {
    const prompt = `Genera una receta con los siguientes ingredientes: ${ingredients.join(', ')}. El formato debe ser:

Título: [Título de la receta]
Ingredientes:
* [Ingrediente 1]
* [Ingrediente 2]
Instrucciones:
1. **[Paso 1]**
2. **[Paso 2]**
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();

    let title = "";
    let ingredientsList = [];
    let instructionsBuffer = [];
    const lines = generatedText.split('\n').map(l => l.trim()).filter(Boolean);

    let currentSection = '';

    for (const line of lines) {
      if (line.startsWith('Título:')) {
        title = line.replace('Título:', '').trim();
        currentSection = 'title';
      } else if (line.startsWith('Ingredientes:')) {
        currentSection = 'ingredients';
      } else if (line.startsWith('Instrucciones:')) {
        currentSection = 'instructions';
      } else if (currentSection === 'ingredients' && line.startsWith('*')) {
        ingredientsList.push(line.replace('*', '').trim());
      } else if (currentSection === 'instructions') {
        instructionsBuffer.push(line);
      }
    }

    const instructions = instructionsBuffer.join('\n');

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
    });

    res.json({
      Nombre: title || 'Receta Generada',
      Ingredientes: ingredientsList,
      Instrucciones: instructions
    });

  } catch (error) {
    console.error('Error al generar receta:', error);
    res.status(500).json({ error: 'Error al generar la receta' });
  }
}