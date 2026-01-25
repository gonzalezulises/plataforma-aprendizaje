import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import { useNetworkAwareSubmit } from '../hooks/useNetworkAwareSubmit';
import { NetworkErrorBanner } from '../components/NetworkErrorBanner';

// Strip trailing /api from VITE_API_URL to avoid double /api/api paths
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');

function WebinarSchedulePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [courses, setCourses] = useState([]);
  const [formRestored, setFormRestored] = useState(false);

  // Network-aware form submission
  const {
    isSubmitting: loading,
    networkError,
    hasPendingRetry,
    submit,
    retry,
    clearError,
  } = useNetworkAwareSubmit();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    course_id: '',
    scheduled_date: '',
    scheduled_time: '',
    duration_minutes: 60,
    meet_link: '',
    max_attendees: 100
  });
  const [fieldErrors, setFieldErrors] = useState({
    title: '',
    scheduled_date: '',
    scheduled_time: ''
  });

  // localStorage key for webinar form persistence
  const formDataKey = 'webinar_schedule_form';

  // Restore form data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(formDataKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Restore form data
        setFormData(prev => ({
          ...prev,
          title: parsed.title || '',
          description: parsed.description || '',
          course_id: parsed.course_id || '',
          scheduled_date: parsed.scheduled_date || '',
          scheduled_time: parsed.scheduled_time || '',
          duration_minutes: parsed.duration_minutes || 60,
          meet_link: parsed.meet_link || '',
          max_attendees: parsed.max_attendees || 100
        }));
        if (parsed.title || parsed.description) {
          setFormRestored(true);
          console.log('Webinar form data restored from previous session');
        }
      } catch (e) {
        console.error('Error restoring webinar form data:', e);
      }
    }
  }, [formDataKey]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (formData.title || formData.description || formData.scheduled_date) {
      const dataToSave = {
        ...formData,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(formDataKey, JSON.stringify(dataToSave));
    }
  }, [formData, formDataKey]);

  // Clear saved form data
  const clearSavedFormData = () => {
    localStorage.removeItem(formDataKey);
    setFormRestored(false);
  };

  // Default form values for reset
  const defaultFormData = {
    title: '',
    description: '',
    course_id: '',
    scheduled_date: '',
    scheduled_time: '',
    duration_minutes: 60,
    meet_link: '',
    max_attendees: 100
  };

  // Reset form to default values
  const handleResetForm = () => {
    setFormData({ ...defaultFormData });
    setFieldErrors({ title: '', scheduled_date: '', scheduled_time: '' });
    clearSavedFormData();
    toast.success('Formulario restablecido');
  };

  useEffect(() => {
    // Check if user is instructor
    if (isAuthenticated && user?.role !== 'instructor_admin') {
      toast.error('Solo los instructores pueden programar webinars');
      navigate('/webinars');
    }
    fetchCourses();
  }, [isAuthenticated, user, navigate]);

  const fetchCourses = async () => {
    try {
      const response = await fetch(`${API_URL}/api/courses`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCourses(data.courses || data);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field if user starts typing
    if (value && fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields and set field-level errors
    const errors = { title: '', scheduled_date: '', scheduled_time: '' };
    let hasErrors = false;

    if (!formData.title) {
      errors.title = 'El titulo es requerido';
      hasErrors = true;
    }
    if (!formData.scheduled_date) {
      errors.scheduled_date = 'La fecha es requerida';
      hasErrors = true;
    }
    if (!formData.scheduled_time) {
      errors.scheduled_time = 'La hora es requerida';
      hasErrors = true;
    }

    setFieldErrors(errors);

    if (hasErrors) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }

    const performSubmit = async () => {
      // Combine date and time
      const scheduled_at = new Date(`${formData.scheduled_date}T${formData.scheduled_time}`).toISOString();

      const response = await fetch(`${API_URL}/api/webinars`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          course_id: formData.course_id || null,
          scheduled_at,
          duration_minutes: parseInt(formData.duration_minutes),
          meet_link: formData.meet_link || null,
          max_attendees: parseInt(formData.max_attendees)
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al programar el webinar');
      }

      return response.json();
    };

    await submit(performSubmit, {
      preserveData: { ...formData },
      onSuccess: () => {
        // Clear saved form data after successful submission
        clearSavedFormData();
        toast.success('Webinar programado exitosamente');
        navigate('/webinars');
      },
      onError: (error) => {
        console.error('Error scheduling webinar:', error);
        toast.error(error.message || 'Error al programar el webinar');
      },
      onNetworkError: (error) => {
        console.error('Network error scheduling webinar:', error);
        // Form data is preserved, network error banner will show
      },
    });
  };

  // Generate a random Meet link for demo purposes
  const generateMeetLink = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const generatePart = (len) => {
      let result = '';
      for (let i = 0; i < len; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    const meetLink = `https://meet.google.com/${generatePart(3)}-${generatePart(4)}-${generatePart(3)}`;
    setFormData(prev => ({ ...prev, meet_link: meetLink }));
    toast.success('Link de Google Meet generado');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/webinars')}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver a Webinars
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Programar Webinar
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Crea una nueva sesion en vivo para tus estudiantes
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          {/* Form Data Restored Notification */}
          {formRestored && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Tu formulario anterior ha sido restaurado automáticamente.
              </span>
              <button
                type="button"
                onClick={() => setFormRestored(false)}
                className="ml-auto text-blue-500 hover:text-blue-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Network Error Banner */}
          <NetworkErrorBanner
            networkError={networkError}
            onRetry={retry}
            onDismiss={clearError}
            isRetrying={loading}
          />

          {/* Title */}
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Titulo del Webinar <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Ej: Introduccion a Python para Principiantes"
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                fieldErrors.title
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              aria-invalid={!!fieldErrors.title}
              aria-describedby={fieldErrors.title ? 'title-error' : undefined}
            />
            {fieldErrors.title && (
              <p id="title-error" className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {fieldErrors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripcion
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe el contenido y objetivos de la sesion..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Course Selection */}
          <div className="mb-6">
            <label htmlFor="course_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Curso Asociado (opcional)
            </label>
            <select
              id="course_id"
              name="course_id"
              value={formData.course_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Sin curso asociado</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="scheduled_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="scheduled_date"
                name="scheduled_date"
                value={formData.scheduled_date}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  fieldErrors.scheduled_date
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                aria-invalid={!!fieldErrors.scheduled_date}
                aria-describedby={fieldErrors.scheduled_date ? 'date-error' : undefined}
              />
              {fieldErrors.scheduled_date && (
                <p id="date-error" className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {fieldErrors.scheduled_date}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="scheduled_time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hora <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                id="scheduled_time"
                name="scheduled_time"
                value={formData.scheduled_time}
                onChange={handleChange}
                required
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  fieldErrors.scheduled_time
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                aria-invalid={!!fieldErrors.scheduled_time}
                aria-describedby={fieldErrors.scheduled_time ? 'time-error' : undefined}
              />
              {fieldErrors.scheduled_time && (
                <p id="time-error" className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {fieldErrors.scheduled_time}
                </p>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="mb-6">
            <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Duracion (minutos)
            </label>
            <select
              id="duration_minutes"
              name="duration_minutes"
              value={formData.duration_minutes}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">1 hora</option>
              <option value="90">1 hora 30 minutos</option>
              <option value="120">2 horas</option>
              <option value="180">3 horas</option>
            </select>
          </div>

          {/* Google Meet Link */}
          <div className="mb-6">
            <label htmlFor="meet_link" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Link de Google Meet
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                id="meet_link"
                name="meet_link"
                value={formData.meet_link}
                onChange={handleChange}
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={generateMeetLink}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Generar
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Puedes crear el link en Google Meet y pegarlo aqui, o generar uno de ejemplo.
            </p>
          </div>

          {/* Max Attendees */}
          <div className="mb-8">
            <label htmlFor="max_attendees" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Capacidad Maxima
            </label>
            <input
              type="number"
              id="max_attendees"
              name="max_attendees"
              value={formData.max_attendees}
              onChange={handleChange}
              min="1"
              max="1000"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                clearSavedFormData();
                navigate('/webinars');
              }}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleResetForm}
              className="px-6 py-2 border border-orange-300 dark:border-orange-600 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Restablecer
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Programando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Programar Webinar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WebinarSchedulePage;
