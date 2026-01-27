/**
 * Footer component - Identical to rizo.ma footer
 */

function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    servicios: [
      { name: 'Ejecucion', href: 'https://rizo.ma/ejecucion-desempeno' },
      { name: 'Transformacion', href: 'https://rizo.ma/transformacion-organizacional' },
      { name: 'Decision', href: 'https://rizo.ma/decision-estrategica' },
    ],
    nosotros: [
      { name: 'Manifiesto', href: 'https://rizo.ma/manifiesto' },
      { name: 'Impacto', href: 'https://rizo.ma/impacto' },
      { name: 'Tecnologia', href: 'https://rizo.ma/tecnologia' },
      { name: 'Equipo', href: 'https://rizo.ma/equipo' },
    ],
    recursos: [
      { name: 'Recursos', href: 'https://rizo.ma/recursos' },
      { name: 'Blog', href: 'https://rizo.ma/blog' },
      { name: 'Academia', href: '/academia' },
    ],
    legal: [
      { name: 'Terminos', href: 'https://rizo.ma/terminos' },
      { name: 'Privacidad', href: 'https://rizo.ma/privacidad' },
      { name: 'Politicas', href: 'https://rizo.ma/politicas' },
    ],
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Newsletter Section */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-white text-xl font-heading font-semibold">
                Suscribete a nuestro newsletter
              </h3>
              <p className="text-gray-300 mt-1">
                Recibe insights sobre transformacion organizacional y cultura digital.
              </p>
            </div>
            <a
              href="https://rizo.ma/#newsletter"
              className="px-6 py-3 bg-rizoma-green hover:bg-rizoma-green-dark text-white font-medium rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Suscribirme
            </a>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <a href="https://rizo.ma" className="inline-block">
              <picture>
                <source srcSet="/images/brand/logo-plenos-blanco-optimized.webp" type="image/webp" />
                <img
                  src="/images/brand/logo-plenos-blanco-optimized.png"
                  alt="Rizoma"
                  width="83"
                  height="40"
                  className="h-10 w-auto"
                />
              </picture>
            </a>
            <p className="mt-4 text-gray-300 text-sm leading-relaxed">
              Aceleramos la evolucion cultural y digital de tu empresa
            </p>
            {/* Social Links */}
            <div className="flex gap-4 mt-6">
              <a
                href="https://linkedin.com/company/somosrizoma"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-rizoma-green flex items-center justify-center transition-colors"
                aria-label="LinkedIn"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>

            {/* BNI Membership */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-gray-300 text-sm">Miembro de</span>
                <a
                  href="https://www.bni.com/country/panama/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center hover:opacity-80 transition-opacity"
                  title="BNI Capitulo Lovebrand - Panama"
                >
                  <img
                    src="https://rizo.ma/images/partners/bni-logo.svg"
                    alt="BNI"
                    width="70"
                    height="28"
                    className="h-7 w-auto"
                  />
                </a>
              </div>
              <p className="text-gray-300 text-xs mt-1">Capitulo Lovebrand</p>
            </div>
          </div>

          {/* Servicios */}
          <div>
            <h4 className="text-white font-heading font-semibold mb-4">Servicios</h4>
            <ul className="space-y-3">
              {footerLinks.servicios.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-gray-300 hover:text-white transition-colors text-sm">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Nosotros */}
          <div>
            <h4 className="text-white font-heading font-semibold mb-4">Nosotros</h4>
            <ul className="space-y-3">
              {footerLinks.nosotros.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-gray-300 hover:text-white transition-colors text-sm">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <h4 className="text-white font-heading font-semibold mb-4">Recursos</h4>
            <ul className="space-y-3">
              {footerLinks.recursos.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-gray-300 hover:text-white transition-colors text-sm">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-white font-heading font-semibold mb-4">Contacto</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="mailto:ulises@rizo.ma" className="text-gray-300 hover:text-white transition-colors">
                  ulises@rizo.ma
                </a>
              </li>
              <li>
                <a
                  href="https://rizo.ma/agendar"
                  className="inline-flex items-center gap-2 text-emerald-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Agendar reunion
                </a>
              </li>
              <li>
                <a
                  href="https://rizo.ma/carreras"
                  className="inline-flex items-center gap-2 text-rizoma-cyan hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Aplica ahora
                </a>
              </li>
              <li>
                <a
                  href="https://rizo.ma/pagos"
                  className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Formas de pago
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
            <p className="text-gray-300">&copy; {currentYear} Rizoma. Todos los derechos reservados.</p>
            <div className="flex gap-6">
              {footerLinks.legal.map((link) => (
                <a key={link.href} href={link.href} className="text-gray-300 hover:text-white transition-colors">
                  {link.name}
                </a>
              ))}
              <a href="https://rizo.ma/portal" rel="nofollow" className="text-gray-300 hover:text-rizoma-cyan transition-colors" title="Portal de Colaboradores">
                Portal
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
