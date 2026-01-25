# Web Captures Organizer - Resumen del Proyecto

## ✅ Proyecto Creado Exitosamente

Script Python avanzado para procesar capturas de pantalla de iPhone con OCR.

## 📁 Estructura del Proyecto

```
web-captures-organizer/
├── capture_processor.py     # Script principal con OCR
├── requirements.txt          # Dependencias Python
├── INSTALACION.md           # Guía de instalación completa
├── README.md                # Documentación del proyecto
├── RESUMEN.md               # Este archivo
├── resources.md             # Salida generada (se crea al ejecutar)
├── input/                   # Coloca aquí tus capturas
└── processed/               # Capturas procesadas
```

## 🚀 Características Principales

### ✓ Extracción de Texto con OCR
- Usa **Tesseract-OCR** para extraer texto de imágenes
- Soporte para **español e inglés**
- Compatible con capturas de iPhone (HEIC, PNG, JPG)

### ✓ Detección Automática de URLs
- Extrae URLs completas (`https://...`)
- Detecta dominios sin protocolo (`www.ejemplo.com`)
- Limpia y normaliza URLs duplicadas

### ✓ Categorización Inteligente
El script categoriza automáticamente las capturas en:
- 🌐 **Redes Sociales** (Twitter, Instagram, Facebook, LinkedIn, etc.)
- 💻 **Desarrollo** (GitHub, StackOverflow, código)
- 📰 **Noticias** (artículos, blogs, Medium)
- 🛒 **Compras** (Amazon, tiendas online)
- ✅ **Productividad** (Notion, Trello, calendarios)
- 📚 **Educación** (cursos, tutoriales)
- 🎬 **Entretenimiento** (YouTube, Netflix, Spotify)
- 💰 **Finanzas** (pagos, facturas, bancos)
- 📂 **Otros** (contenido sin categoría específica)

### ✓ Generación de Documento Markdown
- Crea `resources.md` organizado por categorías
- Incluye índice navegable
- Muestra texto extraído (primeros 500 caracteres)
- Lista URLs encontradas
- Embebe las imágenes procesadas

### ✓ Organización Automática
- Mueve capturas procesadas a carpeta `processed/`
- Maneja nombres duplicados automáticamente
- Preserva nombres originales

## 📋 Requisitos

### Obligatorios:
- Python 3.8+
- Tesseract-OCR (instalación del sistema)

### Librerías Python:
- `Pillow` - Procesamiento de imágenes
- `pytesseract` - Interface Python para Tesseract

### Opcionales:
- `pillow-heif` - Para imágenes HEIC de iPhone
- `opencv-python` - Procesamiento avanzado
- `exifread` - Metadata de imágenes

## 🔧 Instalación Rápida

### 1. Instalar Tesseract-OCR

**Windows:**
```
1. Descargar desde: https://github.com/UB-Mannheim/tesseract/wiki
2. Instalar con idiomas: English + Spanish
3. Verificar: tesseract --version
```

**macOS:**
```bash
brew install tesseract
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-spa
```

### 2. Instalar Dependencias Python

```bash
pip install -r requirements.txt
```

## 💡 Uso

### Modo Completo (con OCR):

```bash
# 1. Coloca tus capturas en input/
cp ~/Screenshots/*.png input/

# 2. Ejecuta el script
python capture_processor.py

# 3. Revisa el resultado
cat resources.md
```

### Modo Básico (sin OCR):

Si no instalas OCR, el script funciona en modo limitado:
- ✓ Organiza imágenes
- ✓ Categoriza por nombre de archivo
- ✗ No extrae texto
- ✗ No detecta URLs del contenido

## 📊 Ejemplo de Salida

El script genera un archivo `resources.md` como este:

```markdown
# Web Captures - Recursos Organizados con OCR

**Fecha de generación:** 2025-10-15 12:00:00
**Total de capturas:** 15
**Categorías:** 5
**OCR habilitado:** ✓ Sí

## Índice de Categorías
- [Desarrollo](#desarrollo) (5 capturas)
- [Redes Sociales](#redes-sociales) (3 capturas)
- [Noticias](#noticias) (4 capturas)
...

## Desarrollo

### 1. github-profile-screenshot
- **Fecha:** 2025-10-15 10:30:00
- **Archivo:** `github-profile.png`
- **URLs detectadas:** 2
  - https://github.com/usuario
  - https://github.com/usuario/repo

**Texto extraído:**
```
GitHub Profile
@usuario
50 repositories
100 followers
...
```

![github-profile](processed/github-profile.png)
```

## 🎯 Casos de Uso

1. **Documentación de Proyectos**
   - Captura pantallas de referencias web
   - Extrae URLs y texto automáticamente
   - Genera documentación organizada

2. **Investigación y Estudios**
   - Organiza capturas por tema
   - Mantiene registro de fuentes (URLs)
   - Texto extraído para búsquedas

3. **Gestión de Recursos Visuales**
   - Cataloga capturas de diseño/inspiración
   - Categorización automática
   - Fácil navegación por categorías

4. **Archivo Personal**
   - Organiza screenshots del iPhone
   - Encuentra contenido por categoría
   - Preserva información importante

## 🛠️ Personalización

### Añadir/Modificar Categorías

Edita el diccionario `CATEGORIES` en `capture_processor.py`:

```python
CATEGORIES = {
    'Mi Categoría': ['palabra1', 'palabra2', 'keyword3'],
    'Otra Categoría': ['tech', 'software'],
    # ...
}
```

### Cambiar Idiomas de OCR

Modifica la línea en `extract_text_from_image()`:

```python
text = pytesseract.image_to_string(image, lang='spa+eng+fra')  # Español + Inglés + Francés
```

### Ajustar Longitud de Texto Extraído

Cambia el límite en `generate_markdown()`:

```python
preview = text[:1000]  # Mostrar 1000 caracteres en vez de 500
```

## 📚 Archivos del Proyecto

- **capture_processor.py** (380 líneas)
  - Clase `CaptureProcessor` con toda la lógica
  - Métodos para OCR, extracción de URLs, categorización
  - Generación de markdown estructurado

- **requirements.txt**
  - Lista de dependencias Python
  - Instrucciones de instalación de Tesseract

- **INSTALACION.md**
  - Guía detallada paso a paso
  - Solución de problemas comunes
  - Instrucciones por sistema operativo

- **README.md**
  - Documentación completa del proyecto
  - Ejemplos de uso
  - Casos de uso

## ✅ Estado del Proyecto

- [x] Script principal funcionando
- [x] OCR con pytesseract
- [x] Detección de URLs
- [x] Categorización automática
- [x] Generación de markdown
- [x] Manejo de errores
- [x] Documentación completa
- [x] Compatible con Windows/Mac/Linux
- [x] Soporte HEIC (iPhone)

## 🚦 Próximos Pasos

1. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Instalar Tesseract** (ver INSTALACION.md)

3. **Colocar capturas en `input/`**

4. **Ejecutar:**
   ```bash
   python capture_processor.py
   ```

5. **Revisar resultado en `resources.md`**

---

**Proyecto creado:** Octubre 2025
**Python:** 3.8+
**Licencia:** MIT
