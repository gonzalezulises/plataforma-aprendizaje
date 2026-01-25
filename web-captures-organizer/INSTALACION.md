# Guía de Instalación - Web Captures Organizer con OCR

## Requisitos Previos

- Python 3.8 o superior
- pip (gestor de paquetes de Python)

## Instalación Paso a Paso

### 1. Instalar Tesseract-OCR (Motor de OCR)

El script requiere Tesseract-OCR instalado en tu sistema operativo.

#### Windows:

1. **Descarga el instalador:**
   - Ve a: https://github.com/UB-Mannheim/tesseract/wiki
   - Descarga `tesseract-ocr-w64-setup-5.x.x.exe` (última versión)

2. **Instala Tesseract:**
   - Ejecuta el instalador
   - Ruta recomendada: `C:\Program Files\Tesseract-OCR`
   - **IMPORTANTE:** Selecciona instalar los idiomas:
     - English (eng)
     - Spanish (spa)

3. **Añadir a PATH (si no se hizo automáticamente):**
   ```
   Buscar "Variables de entorno" en Windows
   → Editar las variables de entorno del sistema
   → Variables de entorno
   → Path (en Variables del sistema)
   → Nuevo
   → Añadir: C:\Program Files\Tesseract-OCR
   → Aceptar
   ```

4. **Verificar instalación:**
   ```bash
   tesseract --version
   ```

#### macOS:

```bash
brew install tesseract
brew install tesseract-lang  # Para idiomas adicionales
```

#### Linux (Ubuntu/Debian):

```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
sudo apt-get install tesseract-ocr-spa  # Español
sudo apt-get install tesseract-ocr-eng  # Inglés
```

### 2. Instalar Dependencias de Python

Navega al directorio del proyecto y ejecuta:

```bash
cd C:\Users\gonza\claude-projects\web-captures-organizer
pip install -r requirements.txt
```

Esto instalará:
- `Pillow` - Procesamiento de imágenes
- `pytesseract` - Interface Python para Tesseract
- `pillow-heif` - Soporte para imágenes HEIC de iPhone (opcional)

### 3. Configuración Adicional (Windows)

Si Tesseract no se encuentra automáticamente, añade esta línea al inicio de `capture_processor.py`:

```python
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

## Verificar Instalación

Ejecuta este comando para verificar que todo está instalado:

```bash
python -c "import pytesseract; from PIL import Image; print('✓ Todo instalado correctamente')"
```

Si ves el mensaje de éxito, estás listo para usar el script.

## Solución de Problemas

### Error: "tesseract is not installed"

**Solución:**
- Verifica que Tesseract esté instalado ejecutando `tesseract --version`
- Asegúrate de que está en PATH
- En Windows, reinicia la terminal después de añadir a PATH

### Error: "No module named 'PIL'"

**Solución:**
```bash
pip install Pillow
```

### Error: "Failed to load image"

**Solución para imágenes HEIC:**
```bash
pip install pillow-heif
```

### El OCR no detecta texto en español

**Solución:**
- Verifica que el paquete de idioma español esté instalado
- Windows: Reinstala Tesseract y selecciona Spanish
- Linux: `sudo apt-get install tesseract-ocr-spa`
- macOS: Incluido en `brew install tesseract-lang`

## Uso Básico

Una vez instalado todo:

1. Coloca tus capturas de pantalla en `input/`
2. Ejecuta:
   ```bash
   python capture_processor.py
   ```
3. Revisa el resultado en `resources.md`

## Modo Sin OCR

Si no quieres instalar OCR, el script funcionará en modo básico:
- Organizará las imágenes por categorías básicas
- No extraerá texto de las imágenes
- No detectará URLs del contenido

Para ejecutar sin OCR, simplemente no instales Tesseract. El script lo detectará y funcionará en modo limitado.

---

**¿Necesitas ayuda?** Revisa el archivo README.md para más información.
