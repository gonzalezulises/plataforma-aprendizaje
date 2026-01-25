import { MAX_LENGTHS, getCharCountDisplay, getCharCountClasses, exceedsLimit } from '../utils/validationLimits';

/**
 * Input component with built-in max length validation and character counter
 */
export function MaxLengthInput({
  value,
  onChange,
  maxLength,
  label,
  required = false,
  placeholder = '',
  disabled = false,
  error = '',
  className = '',
  type = 'text',
  id,
  ...props
}) {
  const hasError = error || exceedsLimit(value?.length || 0, maxLength);
  const inputId = id || `input-${label?.replace(/\s/g, '-').toLowerCase()}`;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <span className={`text-xs ${getCharCountClasses(value?.length || 0, maxLength)}`}>
          {getCharCountDisplay(value?.length || 0, maxLength)}
        </span>
      </div>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          hasError
            ? 'border-red-500 dark:border-red-500'
            : 'border-gray-300 dark:border-gray-600'
        } ${className}`}
        aria-invalid={hasError}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Textarea component with built-in max length validation and character counter
 */
export function MaxLengthTextarea({
  value,
  onChange,
  maxLength,
  label,
  required = false,
  placeholder = '',
  disabled = false,
  error = '',
  className = '',
  rows = 4,
  id,
  ...props
}) {
  const hasError = error || exceedsLimit(value?.length || 0, maxLength);
  const inputId = id || `textarea-${label?.replace(/\s/g, '-').toLowerCase()}`;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <span className={`text-xs ${getCharCountClasses(value?.length || 0, maxLength)}`}>
          {getCharCountDisplay(value?.length || 0, maxLength)}
        </span>
      </div>
      <textarea
        id={inputId}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          hasError
            ? 'border-red-500 dark:border-red-500'
            : 'border-gray-300 dark:border-gray-600'
        } ${className}`}
        aria-invalid={hasError}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

export default { MaxLengthInput, MaxLengthTextarea };
