# Monitor Automático - Guía Rápida

## 🚀 Inicio Rápido

### Opción 1: Ejecutar directamente

```bash
python auto_monitor.py
```

### Opción 2: Archivo Batch (Windows)

Doble clic en: **`iniciar_monitor.bat`**

## ✨ ¿Qué hace?

El monitor automático:

1. **Observa** la carpeta `input/` continuamente
2. **Detecta** cuando agregas una nueva imagen
3. **Procesa** automáticamente con OCR
4. **Actualiza** el archivo `resources.md`

## 📋 Métodos de Monitoreo

### Con watchdog (Recomendado)
- ✅ Detección instantánea
- ✅ Bajo uso de CPU
- ✅ Usa APIs nativas del sistema

### Con polling (Fallback)
- ⏱️ Verifica cada 5 segundos
- 📊 Funciona sin dependencias adicionales
- 🔄 Se activa automáticamente si watchdog no está disponible

## 🎯 Casos de Uso

### 1. Carpeta sincronizada con iCloud
```
Tu iPhone → iCloud → input/ → Procesamiento automático
```

### 2. AirDrop
```
AirDrop desde iPhone → input/ → Procesamiento automático
```

### 3. Copiar/pegar manualmente
```
Copias imagen → input/ → Procesamiento automático
```

## ⚙️ Configuración

### Cambiar intervalo de polling

Edita `auto_monitor.py`, línea 159:

```python
watch_with_polling(input_dir, script_path, interval=10)  # 10 segundos
```

### Cambiar tiempo de espera (debounce)

Edita `auto_monitor.py`, línea 33:

```python
if current_time - self.last_event_time > 5:  # 5 segundos
```

## 🛑 Detener el Monitor

Presiona **`Ctrl+C`** en la terminal

## 📊 Ejemplo de Salida

```
======================================================================
WEB CAPTURES ORGANIZER - MONITOR AUTOMATICO
======================================================================

Monitor activo (watchdog)
Carpeta: C:\Users\gonza\...\input
Presiona Ctrl+C para detener
```

Cuando detecta una nueva imagen:

```
======================================================================
Nueva imagen detectada - 14:30:45
======================================================================

[Procesamiento automático...]

======================================================================
Procesamiento completado
======================================================================
```

## 🔧 Solución de Problemas

### No detecta imágenes nuevas

**Solución:**
1. Verifica que estás agregando imágenes a la carpeta `input/`
2. Espera 2-5 segundos (debounce activo)
3. Revisa la terminal para mensajes de error

### Alto uso de CPU

**Causa:** Estás en modo polling con intervalo muy corto

**Solución:** Instala watchdog:
```bash
pip install watchdog
```

### El script no se ejecuta

**Solución:**
```bash
cd C:\Users\gonza\claude-projects\web-captures-organizer
python auto_monitor.py
```

## 🚀 Ejecutar al Inicio de Windows

### Método 1: Acceso directo en Inicio

1. Presiona `Win+R` y escribe `shell:startup`
2. Crea acceso directo a `iniciar_monitor.bat`

### Método 2: Task Scheduler

1. Abre "Programador de tareas"
2. Crear tarea básica
3. Ejecutar al iniciar sesión
4. Acción: Iniciar programa
5. Programa: `python.exe`
6. Argumentos: `auto_monitor.py`
7. Carpeta: `C:\Users\gonza\claude-projects\web-captures-organizer`

## 💡 Tips

✅ Deja el monitor corriendo en segundo plano
✅ Combínalo con sincronización en la nube
✅ Revisa `resources.md` para ver texto extraído
✅ El monitor usa caché (no reprocesa archivos)

## 📈 Comparación

| Aspecto | Manual | Automático |
|---------|--------|------------|
| Ejecución | `python capture_processor.py` | Automática |
| Detección | Manual | Instantánea |
| Eficiencia | Procesa todo | Solo nuevos |
| Productividad | ⭐⭐ | ⭐⭐⭐⭐⭐ |

---

**Creado:** Octubre 2025
**Requiere:** Python 3.8+
**Opcional:** watchdog 3.0+ (para mejor rendimiento)
