import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import { csrfFetch } from '../utils/csrf';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\s*$/, '');

export default function UpgradePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('annual');

  // Check for success/error in URL params
  useEffect(() => {
    const status = searchParams.get('status');
    const message = searchParams.get('message');
    const transactionId = searchParams.get('transaction_id');

    if (status === 'success' && transactionId) {
      // Verify the transaction
      verifyTransaction(transactionId);
    } else if (status === 'error' && message) {
      toast.error(decodeURIComponent(message));
    }
  }, [searchParams]);

  // Fetch plans and subscription status
  useEffect(() => {
    fetchPlansAndStatus();
  }, []);

  const fetchPlansAndStatus = async () => {
    try {
      const [plansRes, statusRes] = await Promise.all([
        fetch(`${API_URL}/api/upgrade/plans`, { credentials: 'include' }),
        fetch(`${API_URL}/api/upgrade/status`, { credentials: 'include' })
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans);
        if (plansData.recommended) {
          setSelectedPlan(plansData.recommended);
        }
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSubscriptionStatus(statusData);
      }
    } catch (error) {
      console.error('Error fetching upgrade data:', error);
      toast.error('Error al cargar la informacion de planes');
    } finally {
      setLoading(false);
    }
  };

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
          toast.success('Cuenta actualizada a Premium exitosamente!');
          if (refreshUser) refreshUser();
          // Clear URL params
          navigate('/upgrade', { replace: true });
          fetchPlansAndStatus();
        }
      }
    } catch (error) {
      console.error('Error verifying transaction:', error);
    }
  };

  const handleUpgrade = async (planId) => {
    if (!user) {
      toast.error('Debes iniciar sesion para actualizar tu cuenta');
      navigate('/login?returnUrl=/upgrade');
      return;
    }

    setProcessing(true);
    try {
      const response = await csrfFetch(`${API_URL}/api/upgrade/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });

      const data = await response.json();

      if (response.ok) {
        // For development, show simulation info and auto-complete
        if (data.development) {
          toast.loading('Simulando pago...', { duration: 2000 });

          // In development, redirect to simulate-payment endpoint
          setTimeout(() => {
            window.location.href = `${API_URL}/api/upgrade/simulate-payment?transaction_id=${data.transactionId}`;
          }, 1500);
        } else {
          // In production, redirect to payment URL
          window.location.href = data.paymentUrl;
        }
      } else {
        toast.error(data.error || 'Error al iniciar el proceso de pago');
      }
    } catch (error) {
      console.error('Error initiating upgrade:', error);
      toast.error('Error al conectar con el servidor de pagos');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If already premium, show current subscription info
  if (subscriptionStatus?.isPremium) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Ya eres Premium
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Tienes acceso completo a todos los cursos y funciones premium.
            </p>

            {subscriptionStatus.subscription && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Tu Suscripcion
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Plan:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {subscriptionStatus.subscription.planName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Estado:</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full text-xs font-medium">
                      Activo
                    </span>
                  </div>
                  {subscriptionStatus.subscription.expiresAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Vence:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {new Date(subscriptionStatus.subscription.expiresAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Ir al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Desbloquea tu Potencial
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Accede a todos los cursos premium, ejercicios avanzados y certificaciones verificables.
          </p>
        </div>

        {/* Plan Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl inline-flex">
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                selectedPlan === 'monthly'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setSelectedPlan('annual')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                selectedPlan === 'annual'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Anual
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full text-xs">
                -33%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isAnnual = plan.id === 'annual';

            return (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden transition-all ${
                  isSelected ? 'ring-2 ring-primary-500 scale-105' : 'hover:scale-102'
                } ${!isSelected ? 'opacity-75' : ''}`}
              >
                {isAnnual && (
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-amber-600 text-white text-xs font-bold rounded-full">
                      MAS POPULAR
                    </span>
                  </div>
                )}

                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {plan.name}
                  </h3>

                  <div className="flex items-baseline mb-6">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      ${plan.price}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      {plan.currency} / {isAnnual ? 'año' : 'mes'}
                    </span>
                  </div>

                  {isAnnual && (
                    <p className="text-sm text-green-600 dark:text-green-400 mb-4">
                      Equivale a ${(plan.price / 12).toFixed(2)}/mes - Ahorra 2 meses
                    </p>
                  )}

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={processing}
                    className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {processing ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Procesando...
                      </span>
                    ) : isSelected ? (
                      'Actualizar a Premium'
                    ) : (
                      'Seleccionar Plan'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Badges */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Pago seguro procesado por rizo.ma
          </p>
          <div className="flex justify-center items-center space-x-6">
            <div className="flex items-center text-gray-400">
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">SSL Seguro</span>
            </div>
            <div className="flex items-center text-gray-400">
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
              <span className="text-sm">Garantia 30 dias</span>
            </div>
            <div className="flex items-center text-gray-400">
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Cancela cuando quieras</span>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
            Preguntas Frecuentes
          </h2>
          <div className="space-y-4">
            <details className="bg-white dark:bg-gray-800 rounded-xl p-6 group">
              <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer list-none flex justify-between items-center">
                ¿Que incluye la suscripcion premium?
                <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Con Premium tienes acceso ilimitado a todos los cursos de la plataforma, incluyendo los marcados como premium. Tambien incluye ejercicios avanzados, proyectos con revision de instructores, certificados verificables y soporte prioritario.
              </p>
            </details>
            <details className="bg-white dark:bg-gray-800 rounded-xl p-6 group">
              <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer list-none flex justify-between items-center">
                ¿Puedo cancelar en cualquier momento?
                <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Si, puedes cancelar tu suscripcion en cualquier momento. Mantendras el acceso premium hasta el final del periodo de facturacion actual.
              </p>
            </details>
            <details className="bg-white dark:bg-gray-800 rounded-xl p-6 group">
              <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer list-none flex justify-between items-center">
                ¿Hay garantia de devolucion?
                <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Ofrecemos una garantia de 30 dias. Si no estas satisfecho con tu suscripcion premium, puedes solicitar un reembolso completo dentro de los primeros 30 dias.
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
