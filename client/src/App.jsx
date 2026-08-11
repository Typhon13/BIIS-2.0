import { useEffect, useState } from 'react';

function App() {
  const [dbData, setDbData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch data from Express API
    fetch('http://localhost:5000/api/test-db')
      .then((res) => {
        if (!res.ok) throw new Error('Network response failed');
        return res.json();
      })
      .then((data) => {
        setDbData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>BIIS 2.0 Full-Stack Connection Demo</h1>

      {loading && <p>Connecting to backend...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {dbData && (
        <div style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '8px' }}>
          <p style={{ color: 'green', fontWeight: 'bold' }}>{dbData.message}</p>
          <ul>
            <li><strong>Connected Database:</strong> {dbData.database}</li>
            <li><strong>Database Server Time:</strong> {dbData.timestamp}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
