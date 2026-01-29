import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import { csrfFetch } from '../utils/csrf';

// Feature #28: Account deletion requires email confirmation
// This page handles the email confirmation link for account deletion

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

function ConfirmDeletionPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [status, setStatus] = useState('loading'); // loading, valid, invalid, expired, confirming, success, error
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);

  // Verify token on mount
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setStatus('invalid');
        setError('Token no proporcionado');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/users/confirm-deletion/${token}`, {
          credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.expired) {
            setStatus('expired');
          } else {
            setStatus('invalid');
          }
          setError(data.error || 'Token invalido');
          return;
        }

        if (data.valid) {
          setStatus('valid');
          setUserData({
            name: data.userName,
            email: data.userEmail,
            expiresAt: data.expiresAt
          });
        } else {
          setStatus('invalid');
          setError('Token invalido');
        }
      } catch (err) {
        console.error('Error verifying deletion token:', err);
        setStatus('error');
        setError('Error al verificar el enlace');
      }
    }

    verifyToken();
  }, [token]);

  // Handle confirming the deletion
  const handleConfirmDeletion = async () => {
    setStatus('confirming');

    try {
      const response = await csrfFetch(`${API_URL}/users/confirm-deletion/${token}`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setError(data.error || 'Error al eliminar la cuenta');
        toast.error(data.error || 'Error al eliminar la cuenta');
        return;
      }

      setStatus('success');
      toast.success('Tu cuenta ha sido eliminada permanentemente');

      // Log out the user
      if (logout) {
        await logout();
      }

      // Redirect to home after a delay
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      console.error('Error confirming deletion:', err);
      setStatus('error');
      setError('Error al procesar la eliminacion');
      toast.error('Error al procesar la eliminacion');
    }
  };

  // Render loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // Render invalid/expired token
  if (status === 'invalid' || status === 'expired') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {status === 'expired' ? 'Enlace expirado' : 'Enlace invalido'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {status === 'expired'
              ? 'Este enlace de confirmacion ha expirado. Los enlaces de eliminacion son validos por 24 horas.'
              : error || 'El enlace de confirmacion no es valido o ya fue utilizado.'}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/profile"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Ir a Mi Perfil
            </Link>
            <Link
              to="/"
              className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Render success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Cuenta eliminada
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Tu cuenta ha sido eliminada permanentemente. Todos tus datos han sido borrados de nuestros sistemas.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            Seras redirigido a la pagina de inicio...
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  // Render error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Error
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'Ocurrio un error al procesar la eliminacion de la cuenta.'}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/profile"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Ir a Mi Perfil
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render valid token - confirmation page
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Confirmar eliminacion de cuenta
          </h1>
          {userData && (
            <p className="text-gray-600 dark:text-gray-400">
              {userData.name} ({userData.email})
            </p>
          )}
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Advertencia: Esta accion es irreversible
          </h2>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
            <li>Se eliminaran todos tus cursos inscritos</li>
            <li>Se borraran tus envios y calificaciones</li>
            <li>Se eliminaran tus certificados</li>
            <li>Se borraran todos tus datos personales</li>
            <li>No podras recuperar esta cuenta</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirmDeletion}
            disabled={status === 'confirming'}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
              status === 'confirming'
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {status === 'confirming' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Eliminando cuenta...
              </span>
            ) : (
              'Si, eliminar mi cuenta permanentemente'
            )}
          </button>
          <Link
            to="/profile"
            className="w-full px-6 py-3 text-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeletionPage;
