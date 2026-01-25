import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Hook for warning users about unsaved changes before navigation
 *
 * Features:
 * - Warns on browser navigation (back/forward, close tab, refresh)
 * - Warns on React Router navigation (internal links)
 * - Shows a modal dialog for internal navigation
 * - Uses browser's native confirm dialog for external navigation
 *
 * Note: This implementation works with both data routers and regular Routes
 * by using window.history and beforeunload events.
 *
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 * @param {string} message - Optional custom warning message
 * @returns {Object} - { showModal, confirmNavigation, cancelNavigation, pendingLocation }
 */
export function useUnsavedChangesWarning(hasUnsavedChanges, message = 'Tienes cambios sin guardar. ¿Estas seguro de que quieres salir?') {
  const [showModal, setShowModal] = useState(false);
  const [pendingLocation, setPendingLocation] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isBlockingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);

  // Keep ref in sync with prop
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Warn before browser unload (refresh, close tab, external navigation)
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChangesRef.current) {
        event.preventDefault();
        // Chrome requires returnValue to be set
        event.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [message]);

  // Intercept clicks on links to show confirmation modal
  useEffect(() => {
    const handleClick = (event) => {
      // Only intercept if we have unsaved changes
      if (!hasUnsavedChangesRef.current) return;

      // Find the closest anchor tag
      let target = event.target;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }

      // If no anchor found, or it's an external link, let it go
      if (!target || !target.href) return;

      // Check if it's an internal link (same origin)
      const url = new URL(target.href, window.location.origin);
      if (url.origin !== window.location.origin) return;

      // Check if it's navigating to a different path
      if (url.pathname === location.pathname) return;

      // Prevent the default navigation
      event.preventDefault();
      event.stopPropagation();

      // Store the pending location and show modal
      setPendingLocation(url.pathname);
      setShowModal(true);
    };

    // Use capture phase to intercept before React Router
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [location.pathname]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      if (hasUnsavedChangesRef.current && !isBlockingRef.current) {
        // Block the navigation
        isBlockingRef.current = true;

        // Push the current state back to prevent navigation
        window.history.pushState(null, '', location.pathname);

        // Show confirmation modal
        setPendingLocation('__back__'); // Special marker for back navigation
        setShowModal(true);

        isBlockingRef.current = false;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname]);

  // Confirm navigation - proceed with the blocked navigation
  const confirmNavigation = useCallback(() => {
    setShowModal(false);

    if (pendingLocation === '__back__') {
      // For back navigation, go back in history
      window.history.back();
    } else if (pendingLocation) {
      // For link navigation, navigate to the pending location
      navigate(pendingLocation);
    }

    setPendingLocation(null);
  }, [pendingLocation, navigate]);

  // Cancel navigation - stay on the current page
  const cancelNavigation = useCallback(() => {
    setShowModal(false);
    setPendingLocation(null);
  }, []);

  return {
    showModal,
    confirmNavigation,
    cancelNavigation,
    pendingLocation,
    message,
  };
}

export default useUnsavedChangesWarning;
