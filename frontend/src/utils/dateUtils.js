/**
 * Date utility functions for the learning platform
 * Includes countdown calculations and formatting
 */

/**
 * Calculate the time remaining until a due date
 * @param {string|Date} dueDate - The due date to count down to
 * @returns {Object} An object with days, hours, minutes, seconds, and status info
 */
export function calculateTimeRemaining(dueDate) {
  if (!dueDate) {
    return { isValid: false, isPast: false, total: 0 };
  }

  const now = new Date();
  const due = new Date(dueDate);
  const diff = due.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      isValid: true,
      isPast: true,
      total: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const hours = Math.floor((diff / 1000 / 60 / 60) % 24);
  const days = Math.floor(diff / 1000 / 60 / 60 / 24);

  return {
    isValid: true,
    isPast: false,
    total: diff,
    days,
    hours,
    minutes,
    seconds,
  };
}

/**
 * Format time remaining as a human-readable string
 * @param {string|Date} dueDate - The due date to format countdown for
 * @param {Object} options - Formatting options
 * @param {boolean} options.showSeconds - Whether to show seconds (default: false)
 * @param {boolean} options.abbreviated - Use abbreviated format (default: false)
 * @returns {string} Formatted countdown string
 */
export function formatTimeRemaining(dueDate, options = {}) {
  const { showSeconds = false, abbreviated = false } = options;
  const remaining = calculateTimeRemaining(dueDate);

  if (!remaining.isValid) {
    return 'Sin fecha limite';
  }

  if (remaining.isPast) {
    return 'Vencido';
  }

  const { days, hours, minutes, seconds } = remaining;
  const parts = [];

  if (days > 0) {
    if (abbreviated) {
      parts.push(`${days}d`);
    } else {
      parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);
    }
  }

  if (hours > 0 || days > 0) {
    if (abbreviated) {
      parts.push(`${hours}h`);
    } else {
      parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
    }
  }

  if (minutes > 0 || hours > 0 || days > 0) {
    if (abbreviated) {
      parts.push(`${minutes}m`);
    } else {
      parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
    }
  }

  if (showSeconds && (seconds > 0 || parts.length === 0)) {
    if (abbreviated) {
      parts.push(`${seconds}s`);
    } else {
      parts.push(`${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`);
    }
  }

  // If nothing to show (less than a minute remaining and not showing seconds)
  if (parts.length === 0) {
    return 'Menos de 1 minuto';
  }

  return parts.join(abbreviated ? ' ' : ', ');
}

/**
 * Get the urgency level based on time remaining
 * @param {string|Date} dueDate - The due date to check
 * @returns {string} Urgency level: 'past', 'urgent', 'warning', 'normal'
 */
export function getUrgencyLevel(dueDate) {
  const remaining = calculateTimeRemaining(dueDate);

  if (!remaining.isValid) {
    return 'none';
  }

  if (remaining.isPast) {
    return 'past';
  }

  const totalHours = remaining.days * 24 + remaining.hours;

  if (totalHours < 24) {
    return 'urgent'; // Less than 24 hours - red
  } else if (totalHours < 72) {
    return 'warning'; // Less than 3 days - yellow/orange
  } else {
    return 'normal'; // More than 3 days - normal
  }
}

/**
 * Get CSS classes based on urgency level
 * @param {string} urgency - The urgency level from getUrgencyLevel
 * @returns {Object} Object with text and bg class names
 */
export function getUrgencyClasses(urgency) {
  switch (urgency) {
    case 'past':
      return {
        text: 'text-red-700 dark:text-red-300',
        bg: 'bg-red-100 dark:bg-red-900/30',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-500',
      };
    case 'urgent':
      return {
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-700',
        icon: 'text-red-500',
      };
    case 'warning':
      return {
        text: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-700',
        icon: 'text-amber-500',
      };
    case 'normal':
      return {
        text: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-700',
        icon: 'text-green-500',
      };
    default:
      return {
        text: 'text-gray-600 dark:text-gray-400',
        bg: 'bg-gray-50 dark:bg-gray-800',
        border: 'border-gray-200 dark:border-gray-700',
        icon: 'text-gray-500',
      };
  }
}

/**
 * Format a date for display
 * @param {string|Date} date - The date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  if (!date) return 'N/A';

  const {
    includeTime = false,
    includeWeekday = false,
  } = options;

  const d = new Date(date);
  const formatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeWeekday && { weekday: 'long' }),
    ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
  };

  return d.toLocaleDateString('es-ES', formatOptions);
}
