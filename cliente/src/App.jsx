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

  // Configuración de la URL base de la API
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || window.location.origin;

  const fetchSavedRecipes = useCallback(async () => {
    setRecipesLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes`);
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
      if (!ingredients.trim()) {
        throw new Error('Debes ingresar al menos un ingrediente');
      }

      const response = await fetch(`${API_BASE_URL}/api/generate-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ingredients: ingredients.split(',').map(i => i.trim()).filter(i => i),
          dietaryRestrictions: dietaryRestrictions ? dietaryRestrictions.split(',').map(i => i.trim()).filter(i => i) : [],
          preferences 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al generar la receta');
      }

      const data = await response.json();
      setRecipe(data);
      fetchSavedRecipes();
    } catch (err) {
      setError(err.message);
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

      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>{error}</p>
          <button 
            onClick={() => setError(null)} 
            style={styles.errorCloseButton}
          >
            ×
          </button>
        </div>
      )}

      {showSavedRecipes ? (
        <div style={styles.savedRecipesContainer}>
          <h2 style={styles.subheading}>Recetas Guardadas</h2>
          
          {recipesLoading ? (
            <div style={styles.loadingContainer}>
              <p>Cargando recetas...</p>
            </div>
          ) : savedRecipes.length === 0 ? (
            <p style={styles.noRecipesText}>No hay recetas guardadas aún.</p>
          ) : (
            <div style={styles.recipesGrid}>
              {savedRecipes.map((recipe) => (
                <div key={recipe.id} style={styles.recipeCard}>
                  <div style={styles.recipeHeader}>
                    <h3 style={styles.recipeTitle}>{recipe.title || 'Receta sin nombre'}</h3>
                  </div>
                  <div style={styles.recipeContent}>
                    <h4 style={styles.recipeSubtitle}>Ingredientes:</h4>
                    <ul style={styles.list}>
                      {recipe.ingredients && recipe.ingredients.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                    <h4 style={styles.recipeSubtitle}>Instrucciones:</h4>
                    <div style={styles.instructions}>
                      {recipe.instructions && recipe.instructions.map((step, i) => (
                        <p key={i}>{i+1}. {step}</p>
                      ))}
                    </div>
                    <div style={styles.originalIngredients}>
                      <h4 style={styles.recipeSubtitle}>Ingredientes originales:</h4>
                      <p>{recipe.originalIngredients?.join(', ') || 'No disponible'}</p>
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
                placeholder="Ej: pollo, arroz, zanahorias"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label htmlFor="dietaryRestrictions" style={styles.label}>
                Restricciones dietéticas (opcional, separadas por comas):
              </label>
              <input
                type="text"
                id="dietaryRestrictions"
                value={dietaryRestrictions}
                onChange={(e) => setDietaryRestrictions(e.target.value)}
                style={styles.input}
                placeholder="Ej: vegetariano, sin gluten"
              />
            </div>
            <div style={styles.formGroup}>
              <label htmlFor="preferences" style={styles.label}>
                Preferencias (opcional):
              </label>
              <input
                type="text"
                id="preferences"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                style={styles.input}
                placeholder="Ej: rápido, bajo en calorías"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              style={{
                ...styles.button,
                ...(loading && styles.buttonLoading)
              }}
            >
              {loading ? (
                <>
                  <span style={styles.spinner}></span>
                  Generando...
                </>
              ) : 'Generar Receta'}
            </button>
          </form>

          {recipe && (
            <div style={styles.recipeCard}>
              <div style={styles.recipeHeader}>
                <h2 style={styles.recipeTitle}>{recipe.title}</h2>
              </div>
              <div style={styles.recipeContent}>
                <h3 style={styles.recipeSubtitle}>Ingredientes:</h3>
                <ul style={styles.list}>
                  {recipe.ingredients && recipe.ingredients.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
                <h3 style={styles.recipeSubtitle}>Instrucciones:</h3>
                <div style={styles.instructions}>
                  {recipe.instructions && recipe.instructions.map((step, i) => (
                    <p key={i}>{i+1}. {step}</p>
                  ))}
                </div>
                <div style={styles.originalIngredients}>
                  <h3 style={styles.recipeSubtitle}>Ingredientes originales:</h3>
                  <p>{recipe.originalIngredients?.join(', ') || 'No disponible'}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Estilos actualizados
const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    minHeight: '100vh',
    color: '#333',
  },
  heading: {
    textAlign: 'center',
    color: '#2c3e50',
    marginBottom: '30px',
    fontSize: '2.5rem',
    fontWeight: '600',
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
    fontWeight: '500',
  },
  activeTab: {
    backgroundColor: '#3498db',
    fontWeight: 'bold',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
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
    fontSize: '1rem',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    boxSizing: 'border-box',
    transition: 'border 0.3s',
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
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  buttonLoading: {
    backgroundColor: '#27ae60',
    opacity: '0.8',
  },
  spinner: {
    border: '3px solid rgba(255,255,255,0.3)',
    borderRadius: '50%',
    borderTop: '3px solid white',
    width: '20px',
    height: '20px',
    animation: 'spin 1s linear infinite',
  },
  errorContainer: {
    backgroundColor: '#fadbd8',
    color: '#e74c3c',
    padding: '15px',
    borderRadius: '4px',
    margin: '20px 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    margin: '0',
    fontWeight: '500',
  },
  errorCloseButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#e74c3c',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 5px',
  },
  savedRecipesContainer: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '20px',
  },
  noRecipesText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: '1.1rem',
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
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    marginBottom: '30px',
  },
  recipeHeader: {
    backgroundColor: '#3498db',
    padding: '15px',
  },
  recipeTitle: {
    color: 'white',
    margin: '0',
    fontSize: '1.4rem',
    fontWeight: '600',
  },
  recipeContent: {
    padding: '20px',
  },
  recipeSubtitle: {
    color: '#2c3e50',
    marginTop: '15px',
    marginBottom: '10px',
    fontSize: '1.1rem',
    fontWeight: '600',
  },
  list: {
    paddingLeft: '20px',
    margin: '10px 0',
    lineHeight: '1.6',
  },
  instructions: {
    lineHeight: '1.6',
  },
  originalIngredients: {
    marginTop: '15px',
    paddingTop: '15px',
    borderTop: '1px solid #eee',
  },
  subheading: {
    color: '#34495e',
    marginTop: '20px',
    marginBottom: '10px',
    fontSize: '1.2rem',
    fontWeight: '600',
  },
};

export default App;