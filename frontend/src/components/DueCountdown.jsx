import { useState, useEffect } from 'react';
import {
  formatTimeRemaining,
  getUrgencyLevel,
  getUrgencyClasses,
  formatDate,
} from '../utils/dateUtils';

/**
 * DueCountdown - A component that displays a live countdown to a due date
 *
 * @param {Object} props
 * @param {string|Date} props.dueDate - The due date to count down to
 * @param {boolean} props.showIcon - Whether to show the clock icon (default: true)
 * @param {boolean} props.showDate - Whether to show the actual date (default: true)
 * @param {boolean} props.abbreviated - Use abbreviated format (default: false)
 * @param {string} props.className - Additional CSS classes
 * @param {number} props.updateInterval - How often to update in ms (default: 60000 - every minute)
 */
export function DueCountdown({
  dueDate,
  showIcon = true,
  showDate = true,
  abbreviated = false,
  className = '',
  updateInterval = 60000, // Update every minute by default
}) {
  const [countdown, setCountdown] = useState(() =>
    formatTimeRemaining(dueDate, { abbreviated })
  );
  const [urgency, setUrgency] = useState(() => getUrgencyLevel(dueDate));

  useEffect(() => {
    // Update immediately when dueDate changes
    setCountdown(formatTimeRemaining(dueDate, { abbreviated }));
    setUrgency(getUrgencyLevel(dueDate));

    // Don't set up interval if no due date
    if (!dueDate) return;

    // Set up interval for live updates
    const interval = setInterval(() => {
      setCountdown(formatTimeRemaining(dueDate, { abbreviated }));
      setUrgency(getUrgencyLevel(dueDate));
    }, updateInterval);

    return () => clearInterval(interval);
  }, [dueDate, abbreviated, updateInterval]);

  if (!dueDate) {
    return (
      <span className={`text-gray-500 dark:text-gray-400 ${className}`}>
        Sin fecha limite
      </span>
    );
  }

  const urgencyClasses = getUrgencyClasses(urgency);

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      data-testid="due-countdown"
      data-urgency={urgency}
    >
      {showIcon && (
        <svg
          className={`w-4 h-4 flex-shrink-0 ${urgencyClasses.icon}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
      <div>
        <span className={`font-medium ${urgencyClasses.text}`} data-testid="countdown-text">
          {countdown}
        </span>
        {showDate && (
          <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">
            ({formatDate(dueDate)})
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * DueCountdownBadge - A compact badge version of the countdown
 */
export function DueCountdownBadge({ dueDate, className = '' }) {
  const [countdown, setCountdown] = useState(() =>
    formatTimeRemaining(dueDate, { abbreviated: true })
  );
  const [urgency, setUrgency] = useState(() => getUrgencyLevel(dueDate));

  useEffect(() => {
    setCountdown(formatTimeRemaining(dueDate, { abbreviated: true }));
    setUrgency(getUrgencyLevel(dueDate));

    if (!dueDate) return;

    const interval = setInterval(() => {
      setCountdown(formatTimeRemaining(dueDate, { abbreviated: true }));
      setUrgency(getUrgencyLevel(dueDate));
    }, 60000);

    return () => clearInterval(interval);
  }, [dueDate]);

  if (!dueDate) return null;

  const urgencyClasses = getUrgencyClasses(urgency);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
        ${urgencyClasses.bg} ${urgencyClasses.text} ${className}`}
      data-testid="due-countdown-badge"
      data-urgency={urgency}
    >
      <svg
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span data-testid="countdown-text">{countdown}</span>
    </span>
  );
}

/**
 * DueCountdownCard - A card version showing detailed countdown info
 */
export function DueCountdownCard({ dueDate, title = 'Fecha de Entrega', className = '' }) {
  const [countdown, setCountdown] = useState(() =>
    formatTimeRemaining(dueDate, { showSeconds: false })
  );
  const [urgency, setUrgency] = useState(() => getUrgencyLevel(dueDate));

  useEffect(() => {
    setCountdown(formatTimeRemaining(dueDate, { showSeconds: false }));
    setUrgency(getUrgencyLevel(dueDate));

    if (!dueDate) return;

    // Update every second when urgent, otherwise every minute
    const updateMs = urgency === 'urgent' ? 1000 : 60000;
    const interval = setInterval(() => {
      setCountdown(formatTimeRemaining(dueDate, { showSeconds: urgency === 'urgent' }));
      setUrgency(getUrgencyLevel(dueDate));
    }, updateMs);

    return () => clearInterval(interval);
  }, [dueDate, urgency]);

  if (!dueDate) return null;

  const urgencyClasses = getUrgencyClasses(urgency);

  return (
    <div
      className={`rounded-lg border p-4 ${urgencyClasses.bg} ${urgencyClasses.border} ${className}`}
      data-testid="due-countdown-card"
      data-urgency={urgency}
    >
      <div className="flex items-center gap-2 mb-2">
        <svg
          className={`w-5 h-5 ${urgencyClasses.icon}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className={`text-sm font-medium ${urgencyClasses.text}`}>
          {title}
        </span>
      </div>
      <div className={`text-lg font-bold ${urgencyClasses.text}`} data-testid="countdown-text">
        {countdown}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {formatDate(dueDate, { includeTime: true, includeWeekday: true })}
      </div>
    </div>
  );
}

export default DueCountdown;
