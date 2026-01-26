/**
 * Race Condition Test Page
 * Feature #228: Late API response handled
 * This page demonstrates that slow API responses don't override newer data
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function RaceConditionTestPage() {
  const [currentData, setCurrentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestLog, setRequestLog] = useState([]);
  const [delayMs, setDelayMs] = useState(3000);

  // Feature #228: Track request ID to prevent stale responses
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    setRequestLog(prev => [...prev, { timestamp, message, type }]);
  };

  // Trigger a request that uses proper cancellation
  const triggerRequest = async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      addLog(`Aborting previous request #${requestIdRef.current}`, 'warning');
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    addLog(`Starting request #${currentRequestId} with ${delayMs}ms delay`, 'info');

    try {
      const response = await fetch(
        `${API_BASE_URL}/test/slow-response?delay=${delayMs}&requestId=${currentRequestId}`,
        { signal: abortControllerRef.current.signal }
      );

      // Feature #228: Check if this request is still the current one
      if (currentRequestId !== requestIdRef.current) {
        addLog(`Request #${currentRequestId} superseded by #${requestIdRef.current}, ignoring response`, 'warning');
        return;
      }

      const data = await response.json();

      // Feature #228: Double-check after JSON parsing
      if (currentRequestId !== requestIdRef.current) {
        addLog(`Request #${currentRequestId} superseded during JSON parse, ignoring`, 'warning');
        return;
      }

      setCurrentData(data);
      addLog(`Request #${currentRequestId} completed successfully`, 'success');
    } catch (error) {
      // Feature #228: Don't update state if request was aborted
      if (error.name === 'AbortError') {
        addLog(`Request #${currentRequestId} was aborted`, 'warning');
        return;
      }

      // Only update error state if this is still the current request
      if (currentRequestId !== requestIdRef.current) {
        addLog(`Request #${currentRequestId} superseded during error handling`, 'warning');
        return;
      }

      addLog(`Request #${currentRequestId} failed: ${error.message}`, 'error');
    } finally {
      // Only update loading state if this is still the current request
      if (requestIdRef.current === currentRequestId) {
        setLoading(false);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const clearLog = () => {
    setRequestLog([]);
    setCurrentData(null);
    requestIdRef.current = 0;
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'warning': return 'text-amber-600 dark:text-amber-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
            <Link to="/" className="hover:text-primary-600">Inicio</Link>
            <span>/</span>
            <span>Test: Race Condition</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Feature #228: Late API Response Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This page demonstrates that slow API responses don't override newer data when users navigate quickly.
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Test Controls</h2>

          <div className="flex flex-wrap gap-4 items-end mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Response Delay (ms)
              </label>
              <input
                type="number"
                value={delayMs}
                onChange={(e) => setDelayMs(parseInt(e.target.value) || 0)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="100"
                max="30000"
                step="100"
              />
            </div>

            <button
              onClick={triggerRequest}
              disabled={loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'Loading...' : 'Send Request'}
            </button>

            <button
              onClick={clearLog}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Clear Log
            </button>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">How to Test:</h3>
            <ol className="list-decimal list-inside text-sm text-amber-700 dark:text-amber-400 space-y-1">
              <li>Set delay to 5000ms (5 seconds)</li>
              <li>Click "Send Request" to start a slow request</li>
              <li>Quickly click "Send Request" again before the first completes</li>
              <li>Observe that the first (slow) response is ignored - only the newer response updates the data</li>
              <li>The log will show "superseded" messages for ignored responses</li>
            </ol>
          </div>
        </div>

        {/* Current Data */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Current Data
            {loading && <span className="ml-2 text-sm text-gray-500">(loading...)</span>}
          </h2>
          {currentData ? (
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto">
              {JSON.stringify(currentData, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No data yet. Click "Send Request" to fetch data.</p>
          )}
        </div>

        {/* Request Log */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Request Log ({requestLog.length} entries)
          </h2>
          <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
            {requestLog.length === 0 ? (
              <p className="text-gray-500">No requests yet.</p>
            ) : (
              <div className="space-y-1">
                {requestLog.map((entry, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-gray-500">[{entry.timestamp}]</span>
                    <span className={getLogColor(entry.type)}>{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Test */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Navigation Test</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Start a slow request, then navigate away. When you return, the old response should not appear.
          </p>
          <div className="flex gap-4">
            <Link
              to="/courses"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Courses
            </Link>
            <Link
              to="/dashboard"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
