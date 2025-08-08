'use client';

import React, { useEffect, useState } from 'react';

const TestCouchDB = () => {
  const [result, setResult] = useState<string>('Probando conexión...');

  useEffect(() => {
    const testConnection = async () => {
      try {
        const res = await fetch(process.env.NEXT_PUBLIC_COUCHDB_URL as string, {
          headers: {
            Authorization:
              'Basic ' + btoa('admin:Purp_2023Tic'), // O usa tu variable de entorno si prefieres
          },
        });

        if (res.ok) {
          const json = await res.json();
          setResult(`✅ Conexión exitosa: ${JSON.stringify(json)}`);
        } else {
          const error = await res.json();
          setResult(`❌ Error: ${error.error} - ${error.reason}`);
        }
      } catch (err: any) {
        setResult(`❌ Excepción: ${err.message}`);
      }
    };

    testConnection();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>🔌 Test Conexión CouchDB</h1>
      <p>{result}</p>
    </div>
  );
};

export default TestCouchDB;
