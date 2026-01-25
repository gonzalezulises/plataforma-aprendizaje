# Monitor Automático - Web Captures Organizer

## 🚀 Descripción

El monitor automático detecta en tiempo real cuando se agregan nuevas imágenes a la carpeta `input/` y las procesa automáticamente con OCR.

## 📋 Características

✅ **Detección en tiempo real** - Usa `watchdog` para detectar archivos nuevos instantáneamente
✅ **Modo fallback** - Si watchdog no está disponible, usa polling (verificación periódica)
✅ **Debounce inteligente** - Espera a que terminen las copias de archivos
✅ **Prevención de duplicados** - No reprocesa archivos ya procesados
✅ **Notificaciones visuales** - Muestra claramente qué está pasando

## 🔧 Instalación

### Opción 1: Instalación automática

```bash
pip install -r requirements.txt
```

### Opción 2: Instalación manual

```bash
pip install watchdog
```

## 🎮 Uso

### Método 1: Script Python

```bash
cd C:\Users\gonza\claude-projects\web-captures-organizer
python watch_folder.py
```

### Método 2: Archivo Batch (Windows)

Doble clic en: `iniciar_monitor.bat`

### Método 3: Desde código Python

```python
from watch_folder import FolderMonitor

monitor = FolderMonitor("input")
monitor.start()
```

## 📊 Comportamiento

### Con watchdog instalado:

```
🚀 WEB CAPTURES ORGANIZER - MONITOR AUTOMÁTICO
======================================================================

🔍 Iniciando monitor con watchdog...
📁 Carpeta: C:\Users\gonza\claude-projects\web-captures-organizer\input
👀 Observando cambios en tiempo real...

✅ Monitor activo!
💤 Esperando nuevas imágenes...

   Presiona Ctrl+C para detener
```

Cuando detecta una nueva imagen:

```
======================================================================
🔔 NUEVA IMAGEN DETECTADA: IMG_1234.JPG
⏰ 2025-10-15 12:30:45
======================================================================

[Procesamiento automático de la imagen]

======================================================================
✅ PROCESAMIENTO COMPLETADO
💤 Esperando nuevas imágenes...
======================================================================
```

### Sin watchdog (modo polling):

```
🚀 WEB CAPTURES ORGANIZER - MONITOR AUTOMÁTICO
======================================================================

🔍 Iniciando monitor con polling...
📁 Carpeta: C:\Users\gonza\claude-projects\web-captures-organizer\input
⏱️  Verificando cada 5 segundos...

📊 Archivos actuales: 8
💤 Esperando nuevas imágenes...
```

## ⚙️ Configuración

### Cambiar intervalo de polling:

Edita `watch_folder.py` y modifica:

```python
monitor.start(use_polling=True, poll_interval=10)  # Verificar cada 10 segundos
```

### Cambiar tiempo de debounce:

En la clase `ImageFileHandler`:

```python
self.debounce_seconds = 5  # Esperar 5 segundos después del último cambio
```

## 🔄 Casos de Uso

### 1. Sincronización con iCloud

Si tu carpeta `input/` está sincronizada con iCloud Photos:

```bash
# El monitor detectará automáticamente cuando iCloud descargue nuevas fotos
python watch_folder.py
```

### 2. AirDrop desde iPhone

Cuando envías capturas por AirDrop a la carpeta `input/`:
- El monitor las detecta instantáneamente
- Las procesa con OCR
- Actualiza `resources.md`

### 3. Carpeta compartida

Si `input/` está en Dropbox, OneDrive, etc.:
- Colaboradores agregan capturas
- Se procesan automáticamente
- Todos ven el `resources.md` actualizado

## 📝 Notas Técnicas

### ¿Cómo funciona watchdog?

Watchdog usa APIs nativas del sistema operativo:
- **Windows**: `ReadDirectoryChangesW`
- **macOS**: `FSEvents`
- **Linux**: `inotify`

Esto permite detección instantánea sin polling.

### ¿Por qué hay modo polling?

Si watchdog no está instalado o no funciona, el script usa polling como fallback:
- Verifica la carpeta cada N segundos
- Compara con el estado anterior
- Procesa archivos nuevos

### Debounce

El debounce espera unos segundos después del último cambio antes de procesar:
- Evita procesar archivos mientras se están copiando
- Agrupa múltiples cambios en una sola ejecución
- Previene procesamiento redundante

## 🛑 Detener el Monitor

Presiona `Ctrl+C` en cualquier momento para detener el monitor de forma segura.

## 🐛 Solución de Problemas

### El monitor no detecta cambios

**Solución:**
1. Verifica que watchdog esté instalado: `pip list | grep watchdog`
2. Reinicia el monitor
3. Si persiste, usa modo polling: `python watch_folder.py` (se activará automáticamente)

### Procesa la misma imagen varias veces

**Causa:** El debounce es muy corto

**Solución:** Aumenta `debounce_seconds` en `watch_folder.py`

### Error: "No such file or directory"

**Causa:** La carpeta `input/` no existe

**Solución:**
```bash
mkdir input
```

### Uso alto de CPU (modo polling)

**Causa:** Intervalo de polling muy corto

**Solución:** Aumenta `poll_interval` a 10-30 segundos

## 🚀 Ejecutar en Segundo Plano

### Windows (Task Scheduler):

Crea una tarea programada que ejecute al inicio:

```
Programa: pythonw.exe
Argumentos: C:\Users\gonza\claude-projects\web-captures-organizer\watch_folder.py
Carpeta: C:\Users\gonza\claude-projects\web-captures-organizer
```

### Windows (como servicio):

Usa `nssm` (Non-Sucking Service Manager):

```bash
nssm install CapturesMonitor python.exe C:\...\watch_folder.py
nssm start CapturesMonitor
```

### macOS/Linux:

Usa `screen` o `tmux`:

```bash
screen -S captures_monitor
python watch_folder.py
# Presiona Ctrl+A, luego D para detach
```

O con `systemd` (Linux):

```ini
[Unit]
Description=Web Captures Monitor

[Service]
ExecStart=/usr/bin/python3 /path/to/watch_folder.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## 📈 Ventajas vs Procesamiento Manual

| Aspecto | Manual | Automático |
|---------|--------|------------|
| Detección | Debes verificar | Instantánea |
| Ejecución | `python capture_processor.py` | Automática |
| Eficiencia | Procesa todo | Solo nuevos |
| Productividad | Baja | Alta |
| Errores | Puedes olvidarlo | Nunca falla |

## 💡 Tips

1. **Deja el monitor corriendo** mientras trabajas con capturas
2. **Usa con sincronización en la nube** para procesamiento automático
3. **Revisa resources.md** periódicamente para ver el contenido extraído
4. **Combina con la tarea programada** del organizador de Downloads

---

**Creado:** Octubre 2025
**Requiere:** Python 3.8+, watchdog 3.0+
