import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUpload } from '../components/FileUpload';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function FileUploadTestPage() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [lastError, setLastError] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Prueba de Subida de Archivos
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Pagina de prueba para verificar el manejo de errores en la subida de archivos
          </p>
        </div>

        {/* Test Cases Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Casos de Prueba
          </h2>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li><strong>Archivo muy grande:</strong> Intenta subir un archivo mayor a 10MB para ver el error de tamano</li>
            <li><strong>Tipo no permitido:</strong> Intenta subir un archivo .exe o .bat para ver el error de tipo</li>
            <li><strong>Error de red:</strong> Desconecta la red o detiene el backend para ver el error de conexion</li>
            <li><strong>Reintento:</strong> Despues de un error de red, verifica que puedas reintentar la subida</li>
            <li><strong>Seleccion de otro archivo:</strong> Despues de un error de validacion, verifica que puedas seleccionar otro archivo</li>
          </ul>
        </div>

        {/* File Upload Component */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Subir Archivo
          </h2>

          <FileUpload
            uploadUrl={`${API_URL}/uploads/single`}
            accept=".pdf,.doc,.docx,.txt,.py,.js,.ts,.zip,.png,.jpg,.jpeg,.md,.json,.csv"
            maxSize={10 * 1024 * 1024}
            multiple={false}
            onUploadSuccess={(response) => {
              setUploadedFiles(prev => [...prev, response.upload]);
              setLastError(null);
            }}
            onUploadError={(error, errorInfo) => {
              console.error('Upload error:', error);
              setLastError(errorInfo);
            }}
          />
        </div>

        {/* Test with Invalid URL (simulate network error) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Prueba Error de Red (URL invalida)
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Esta seccion usa una URL incorrecta para simular un error de red
          </p>

          <FileUpload
            uploadUrl="http://localhost:9999/api/uploads/single"
            accept=".pdf,.doc,.docx,.txt,.py,.js,.ts,.zip,.png,.jpg,.jpeg"
            maxSize={10 * 1024 * 1024}
            multiple={false}
            onUploadSuccess={(response) => {
            }}
            onUploadError={(error, errorInfo) => {
              setLastError(errorInfo);
            }}
          />
        </div>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Archivos Subidos Exitosamente ({uploadedFiles.length})
            </h2>
            <div className="space-y-3">
              {uploadedFiles.map((file, index) => (
                <div
                  key={file.id || index}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {file.original_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        ID: {file.id} | {file.mimetype}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Error Display */}
        {lastError && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-md p-6 border border-red-200 dark:border-red-800">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
              Ultimo Error Detectado
            </h2>
            <pre className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">
              {JSON.stringify(lastError, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
