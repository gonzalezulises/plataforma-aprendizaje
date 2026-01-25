# Web Captures Organizer

Script automatizado para organizar y documentar capturas de pantalla web.

## Estructura del Proyecto

```
web-captures-organizer/
├── capture_processor.py     # Script principal
├── requirements.txt          # Dependencias
├── README.md                 # Este archivo
├── input/                    # Capturas de pantalla a procesar
├── processed/                # Capturas ya procesadas
└── resources.md              # Documento de salida generado
```

## Características

- ✅ Organiza automáticamente capturas de pantalla
- ✅ Extrae información de nombres de archivo
- ✅ Genera documento markdown con todas las capturas
- ✅ Mueve archivos procesados a carpeta separada
- ✅ Maneja archivos duplicados automáticamente
- ✅ Compatible con múltiples formatos de imagen (PNG, JPG, GIF, etc.)

## Instalación

1. Clona o descarga este proyecto
2. Instala Python 3.x si no lo tienes instalado
3. (Opcional) Instala dependencias adicionales:
   ```bash
   pip install -r requirements.txt
   ```

## Uso

### Uso Básico

1. **Coloca tus capturas** en la carpeta `input/`

2. **Ejecuta el script:**
   ```bash
   python capture_processor.py
   ```

3. **Revisa los resultados:**
   - Capturas procesadas en: `processed/`
   - Documento generado en: `resources.md`

### Ejemplo de Salida

El script genera un archivo `resources.md` con este formato:

```markdown
# Web Captures - Recursos Organizados

**Fecha de generación:** 2025-10-15 20:30:00

## Capturas Procesadas

### 1. Captura-dashboard-2025
- **Fecha:** 2025-10-15
- **Archivo original:** `Captura-dashboard-2025.png`
- **Ubicación:** `processed/Captura-dashboard-2025.png`

![Captura 1](processed/Captura-dashboard-2025.png)
```

## Formatos de Imagen Soportados

- PNG (.png)
- JPEG (.jpg, .jpeg)
- GIF (.gif)
- BMP (.bmp)
- WEBP (.webp)

## Extracción de Fechas

El script intenta extraer fechas de los nombres de archivo en estos formatos:
- `YYYY-MM-DD` (2025-10-15)
- `DD-MM-YYYY` (15-10-2025)
- `YYYYMMDD` (20251015)

Si no encuentra fecha en el nombre, usa la fecha de modificación del archivo.

## Personalización

Puedes modificar el comportamiento del script editando estas variables en `capture_processor.py`:

```python
processor = CaptureProcessor(
    input_dir="input",          # Carpeta de entrada
    processed_dir="processed",  # Carpeta de salida
    output_file="resources.md"  # Archivo markdown
)
```

## Casos de Uso

- 📸 Documentar capturas de pantalla de proyectos web
- 📚 Crear archivos de recursos visuales
- 🗂️ Organizar screenshots de investigación
- 📊 Generar reportes visuales automáticos
- 🎨 Catalogar diseños y mockups

## Solución de Problemas

### No se procesan las imágenes
- Verifica que las imágenes estén en la carpeta `input/`
- Asegúrate de que los archivos tengan extensiones válidas

### Error de codificación en Windows
- El script incluye manejo automático de UTF-8 para Windows
- Si persiste, verifica la configuración de tu terminal

### Archivos duplicados
- El script maneja automáticamente nombres duplicados añadiendo `_1`, `_2`, etc.

## Contribuciones

Este es un proyecto de ejemplo. Siéntete libre de modificarlo según tus necesidades.

## Licencia

MIT License - Uso libre para proyectos personales y comerciales.

---

**Creado con:** Python 3.x
**Última actualización:** Octubre 2025
