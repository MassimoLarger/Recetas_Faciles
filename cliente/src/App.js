import React, { useState, useEffect, useCallback } from 'react';

function App() {
  const [ingredients, setIngredients] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [preferences, setPreferences] = useState('');
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [showSavedRecipes, setShowSavedRecipes] = useState(false);
  const [recipesLoading, setRecipesLoading] = useState(false);

  // Configuración base de la API para desarrollo y producción
  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? '' 
    : 'https://recetas-faciles-eta.vercel.app';

  // Función memoizada con useCallback
  const fetchSavedRecipes = useCallback(async () => {
    setRecipesLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/get-recipes`);
      if (!response.ok) throw new Error('Error al cargar recetas');
      const data = await response.json();
      setSavedRecipes(data);
    } catch (err) {
      setError('Error al cargar recetas: ' + err.message);
    } finally {
      setRecipesLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    if (showSavedRecipes) {
      fetchSavedRecipes();
    }
  }, [showSavedRecipes, fetchSavedRecipes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRecipe(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ingredients, dietaryRestrictions, preferences }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRecipe(data);
      fetchSavedRecipes();
    } catch (err) {
      setError('Failed to generate or save recipe: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Asistente de Recetas con IA</h1>
      
      <div style={styles.tabContainer}>
        <button 
          onClick={() => setShowSavedRecipes(false)} 
          style={{
            ...styles.tabButton,
            ...(!showSavedRecipes && styles.activeTab)
          }}
        >
          Generar Nueva Receta
        </button>
        <button 
          onClick={() => setShowSavedRecipes(true)}
          style={{
            ...styles.tabButton,
            ...(showSavedRecipes && styles.activeTab)
          }}
        >
          Ver Recetas Guardadas
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {showSavedRecipes ? (
        <div style={styles.savedRecipesContainer}>
          <h2 style={styles.subheading}>Recetas Guardadas</h2>
          
          {recipesLoading ? (
            <p>Cargando recetas...</p>
          ) : savedRecipes.length === 0 ? (
            <p>No hay recetas guardadas aún.</p>
          ) : (
            <div style={styles.recipesGrid}>
              {savedRecipes.map((recipe) => (
                <div key={recipe.id} style={styles.recipeCard}>
                  <h3 style={styles.recipeTitle}>{recipe.Nombre}</h3>
                  <div style={styles.recipeContent}>
                    <h4 style={styles.recipeSubtitle}>Ingredientes:</h4>
                    <ul style={styles.list}>
                      {recipe.Ingredientes.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                    <h4 style={styles.recipeSubtitle}>Instrucciones:</h4>
                    <div style={styles.instructions}>
                      {recipe.Instrucciones.split('\n').map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label htmlFor="ingredients" style={styles.label}>
                Ingredientes disponibles (separados por comas):
              </label>
              <input
                type="text"
                id="ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label htmlFor="dietaryRestrictions" style={styles.label}>
                Restricciones dietéticas (ej. vegetariano, sin gluten):
              </label>
              <input
                type="text"
                id="dietaryRestrictions"
                value={dietaryRestrictions}
                onChange={(e) => setDietaryRestrictions(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label htmlFor="preferences" style={styles.label}>
                Preferencias (ej. rápido, bajo en calorías):
              </label>
              <input
                type="text"
                id="preferences"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                style={styles.input}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              style={styles.button}
            >
              {loading ? 'Generando...' : 'Generar Receta'}
            </button>
          </form>

          {recipe && (
            <div style={styles.recipeCard}>
              <h2 style={styles.recipeTitle}>{recipe.Nombre}</h2>
              <div style={styles.recipeContent}>
                <h3 style={styles.subheading}>Ingredientes:</h3>
                <ul style={styles.list}>
                  {recipe.Ingredientes.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
                <h3 style={styles.subheading}>Instrucciones:</h3>
                <div style={styles.instructions}>
                  {recipe.Instrucciones.split('\n').map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  heading: {
    textAlign: 'center',
    color: '#2c3e50',
    marginBottom: '30px',
    fontSize: '2.5rem',
  },
  tabContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '30px',
    gap: '10px',
  },
  tabButton: {
    padding: '12px 24px',
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
  },
  activeTab: {
    backgroundColor: '#3498db',
    fontWeight: 'bold',
  },
  form: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    marginBottom: '30px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    color: '#34495e',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#2ecc71',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '18px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    marginTop: '10px',
  },
  'button:hover': {
    backgroundColor: '#27ae60',
  },
  error: {
    color: '#e74c3c',
    textAlign: 'center',
    margin: '20px 0',
    padding: '10px',
    backgroundColor: '#fadbd8',
    borderRadius: '4px',
  },
  savedRecipesContainer: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  recipesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  recipeCard: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    transition: 'transform 0.3s ease',
  },
  recipeTitle: {
    backgroundColor: '#3498db',
    color: 'white',
    padding: '15px',
    margin: 0,
    fontSize: '1.4rem',
  },
  recipeContent: {
    padding: '20px',
  },
  recipeSubtitle: {
    color: '#2c3e50',
    marginTop: '15px',
    marginBottom: '10px',
    fontSize: '1.1rem',
  },
  list: {
    paddingLeft: '20px',
    margin: '10px 0',
    lineHeight: '1.6',
  },
  instructions: {
    lineHeight: '1.6',
    whiteSpace: 'pre-line',
  },
  subheading: {
    color: '#34495e',
    marginTop: '20px',
    marginBottom: '10px',
    fontSize: '1.2rem',
  },
};

export default App;