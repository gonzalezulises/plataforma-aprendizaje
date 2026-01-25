#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monitor de Carpeta - Web Captures Organizer
Detecta automáticamente nuevas imágenes en la carpeta input/ y las procesa.
"""

import sys
import time
from pathlib import Path
from datetime import datetime

# Configurar salida UTF-8 para Windows (solo si no está ya configurado)
if sys.platform == 'win32':
    try:
        import io
        if not isinstance(sys.stdout, io.TextIOWrapper) or sys.stdout.encoding != 'utf-8':
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass  # Ya está configurado o no es necesario

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    print("⚠ watchdog no está instalado.")
    print("  Instala con: pip install watchdog")
    print("  El script funcionará en modo polling (menos eficiente)")
    print()

from capture_processor import CaptureProcessor


class ImageFileHandler(FileSystemEventHandler):
    """Manejador de eventos de archivos de imagen."""

    def __init__(self, processor):
        """
        Inicializa el manejador.

        Args:
            processor: Instancia de CaptureProcessor
        """
        self.processor = processor
        self.processing = False
        self.last_process_time = 0
        self.debounce_seconds = 2  # Esperar 2 segundos después del último cambio

    def is_image_file(self, file_path):
        """Verifica si el archivo es una imagen."""
        extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.heic']
        return Path(file_path).suffix.lower() in extensions

    def on_created(self, event):
        """Se ejecuta cuando se crea un archivo."""
        if event.is_directory:
            return

        if self.is_image_file(event.src_path):
            self.trigger_processing(event.src_path)

    def on_modified(self, event):
        """Se ejecuta cuando se modifica un archivo."""
        if event.is_directory:
            return

        if self.is_image_file(event.src_path):
            self.trigger_processing(event.src_path)

    def trigger_processing(self, file_path):
        """
        Dispara el procesamiento de capturas.

        Args:
            file_path: Ruta del archivo que cambió
        """
        current_time = time.time()

        # Debounce: esperar a que pasen unos segundos sin cambios
        if current_time - self.last_process_time < self.debounce_seconds:
            return

        if self.processing:
            return

        self.processing = True
        self.last_process_time = current_time

        try:
            print(f"\n{'='*70}")
            print(f"🔔 NUEVA IMAGEN DETECTADA: {Path(file_path).name}")
            print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'='*70}\n")

            # Esperar un poco para asegurar que el archivo esté completamente copiado
            time.sleep(1)

            # Procesar capturas
            self.processor.process_captures()

            print(f"\n{'='*70}")
            print("✅ PROCESAMIENTO COMPLETADO")
            print("💤 Esperando nuevas imágenes...")
            print(f"{'='*70}\n")

        except Exception as e:
            print(f"\n❌ ERROR durante el procesamiento: {e}\n")

        finally:
            self.processing = False


class FolderMonitor:
    """Monitor de carpeta usando watchdog."""

    def __init__(self, input_dir):
        """
        Inicializa el monitor.

        Args:
            input_dir: Directorio a monitorear
        """
        self.input_dir = Path(input_dir)
        self.processor = CaptureProcessor()
        self.observer = None

    def start_watchdog(self):
        """Inicia el monitoreo usando watchdog."""
        if not WATCHDOG_AVAILABLE:
            return False

        print(f"🔍 Iniciando monitor con watchdog...")
        print(f"📁 Carpeta: {self.input_dir}")
        print(f"👀 Observando cambios en tiempo real...\n")

        event_handler = ImageFileHandler(self.processor)
        self.observer = Observer()
        self.observer.schedule(event_handler, str(self.input_dir), recursive=False)
        self.observer.start()

        print("✅ Monitor activo!")
        print("💤 Esperando nuevas imágenes...\n")
        print("   Presiona Ctrl+C para detener\n")
        print(f"{'='*70}\n")

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\n⚠ Deteniendo monitor...")
            self.observer.stop()

        self.observer.join()
        print("✅ Monitor detenido.\n")
        return True

    def start_polling(self, interval=5):
        """
        Inicia el monitoreo usando polling (verificación periódica).

        Args:
            interval: Segundos entre cada verificación
        """
        print(f"🔍 Iniciando monitor con polling...")
        print(f"📁 Carpeta: {self.input_dir}")
        print(f"⏱️  Verificando cada {interval} segundos...\n")

        # Obtener estado inicial
        last_files = set(self.processor.get_image_files())
        last_count = len(last_files)

        print(f"📊 Archivos actuales: {last_count}")
        print("💤 Esperando nuevas imágenes...\n")
        print("   Presiona Ctrl+C para detener\n")
        print(f"{'='*70}\n")

        try:
            while True:
                time.sleep(interval)

                # Verificar nuevos archivos
                current_files = set(self.processor.get_image_files())
                new_files = current_files - last_files

                if new_files:
                    print(f"\n{'='*70}")
                    print(f"🔔 {len(new_files)} NUEVA(S) IMAGEN(ES) DETECTADA(S)")
                    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                    for f in new_files:
                        print(f"   📄 {f.name}")
                    print(f"{'='*70}\n")

                    # Procesar
                    self.processor.process_captures()

                    print(f"\n{'='*70}")
                    print("✅ PROCESAMIENTO COMPLETADO")
                    print("💤 Esperando nuevas imágenes...")
                    print(f"{'='*70}\n")

                    # Actualizar estado
                    last_files = current_files

        except KeyboardInterrupt:
            print("\n\n⚠ Deteniendo monitor...")

        print("✅ Monitor detenido.\n")

    def start(self, use_polling=False, poll_interval=5):
        """
        Inicia el monitor.

        Args:
            use_polling: Si es True, usa polling en vez de watchdog
            poll_interval: Intervalo de polling en segundos
        """
        print("\n" + "="*70)
        print("🚀 WEB CAPTURES ORGANIZER - MONITOR AUTOMÁTICO")
        print("="*70 + "\n")

        # Verificar que la carpeta existe
        if not self.input_dir.exists():
            print(f"❌ Error: La carpeta {self.input_dir} no existe.")
            return

        # Elegir método de monitoreo
        if use_polling or not WATCHDOG_AVAILABLE:
            self.start_polling(poll_interval)
        else:
            self.start_watchdog()


def main():
    """Función principal."""
    base_dir = Path(__file__).parent
    input_dir = base_dir / "input"

    monitor = FolderMonitor(input_dir)

    # Usar watchdog si está disponible, sino polling
    monitor.start(use_polling=not WATCHDOG_AVAILABLE, poll_interval=5)


if __name__ == "__main__":
    main()
