import { Link, useLocation } from 'react-router-dom';

function Navbar() {
  const location = useLocation();

  const navLinks = [
    { path: '/courses', label: 'Cursos' },
    { path: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo - Clickable link to home */}
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 transition-colors"
              aria-label="Ir al inicio"
            >
              <svg
                className="h-8 w-8"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="32" height="32" rx="8" fill="currentColor" />
                <path
                  d="M8 12L16 8L24 12V20L16 24L8 20V12Z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 16V24"
                  stroke="white"
                  strokeWidth="2"
                />
                <path
                  d="M8 12L16 16L24 12"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Plataforma
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden sm:flex sm:items-center sm:space-x-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side - Login/Profile */}
          <div className="flex items-center space-x-4">
            <Link
              to="/login"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white text-sm font-medium transition-colors"
            >
              Iniciar Sesion
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
