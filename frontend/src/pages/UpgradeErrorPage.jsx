import { useNavigate, useSearchParams } from 'react-router-dom';

export default function UpgradeErrorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message') || 'Hubo un problema al procesar tu pago';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          {/* Error Icon */}
          <div className="w-24 h-24 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Pago no completado
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {decodeURIComponent(message)}
          </p>

          {/* Troubleshooting */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-8 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              ¿Que puedes hacer?
            </h3>
            <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Verifica que tu metodo de pago tenga fondos suficientes
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Intenta con un metodo de pago diferente
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Si el problema persiste, contacta a soporte
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/upgrade')}
              className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Intentar de nuevo
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Volver al Dashboard
            </button>
          </div>

          {/* Support Link */}
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            ¿Necesitas ayuda?{' '}
            <a href="mailto:soporte@rizo.ma" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Contacta a soporte
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
