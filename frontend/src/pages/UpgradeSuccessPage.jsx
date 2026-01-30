import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import { csrfFetch } from '../utils/csrf';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\s*$/, '');

export default function UpgradeSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    const transactionId = searchParams.get('transaction_id');
    if (transactionId) {
      verifyTransaction(transactionId);
    } else {
      setVerifying(false);
      setVerified(true); // Assume success if redirected here without transaction_id
    }
  }, [searchParams]);

  const verifyTransaction = async (transactionId) => {
    try {
      const response = await csrfFetch(`${API_URL}/api/upgrade/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVerified(true);
          setSubscription(data.subscription);
          if (refreshUser) refreshUser();
          toast.success('Tu cuenta ha sido actualizada a Premium!');
        } else {
          toast.error('No se pudo verificar el pago');
        }
      }
    } catch (error) {
      console.error('Error verifying transaction:', error);
      toast.error('Error al verificar la transaccion');
    } finally {
      setVerifying(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando tu pago...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          {/* Success Animation */}
          <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Bienvenido a Premium!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Tu cuenta ha sido actualizada exitosamente. Ahora tienes acceso a todos los cursos y funciones premium.
          </p>

          {subscription && (
            <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 rounded-xl p-6 mb-8 border border-amber-200 dark:border-amber-700">
              <div className="flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                {subscription.planName}
              </h3>
              {subscription.expiresAt && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Valido hasta: {new Date(subscription.expiresAt).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              )}
            </div>
          )}

          {/* What's Next */}
          <div className="text-left mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              ¿Que puedes hacer ahora?
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="w-6 h-6 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <span className="text-primary-600 dark:text-primary-400 text-sm font-bold">1</span>
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  Explora todos los cursos premium disponibles
                </span>
              </li>
              <li className="flex items-start">
                <span className="w-6 h-6 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <span className="text-primary-600 dark:text-primary-400 text-sm font-bold">2</span>
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  Completa ejercicios avanzados y proyectos reales
                </span>
              </li>
              <li className="flex items-start">
                <span className="w-6 h-6 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <span className="text-primary-600 dark:text-primary-400 text-sm font-bold">3</span>
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  Obtén certificados verificables al completar cursos
                </span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/courses')}
              className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Explorar Cursos Premium
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Ir al Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
