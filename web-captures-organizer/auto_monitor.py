#!/usr/bin/env python3
"""
Monitor Automático Simplificado - Web Captures Organizer
Detecta nuevas imágenes y ejecuta el procesador automáticamente.
"""

import time
import subprocess
from pathlib import Path
from datetime import datetime

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    print("Watchdog no instalado. Usando modo polling.")


class ImageWatcher(FileSystemEventHandler):
    """Observador de archivos de imagen."""

    def __init__(self, script_path):
        self.script_path = script_path
        self.processing = False
        self.last_event_time = 0
        self.extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.heic'}

    def is_image(self, path):
        return Path(path).suffix.lower() in self.extensions

    def on_created(self, event):
        if not event.is_directory and self.is_image(event.src_path):
            self.process()

    def on_modified(self, event):
        if not event.is_directory and self.is_image(event.src_path):
            current_time = time.time()
            if current_time - self.last_event_time > 2:  # Debounce 2 segundos
                self.last_event_time = current_time
                self.process()

    def process(self):
        if self.processing:
            return

        self.processing = True
        try:
            print(f"\n{'='*70}")
            print(f"Nueva imagen detectada - {datetime.now().strftime('%H:%M:%S')}")
            print(f"{'='*70}\n")

            time.sleep(1)  # Esperar que termine la copia

            # Ejecutar procesador
            result = subprocess.run(
                ['python', str(self.script_path)],
                capture_output=False,
                cwd=self.script_path.parent
            )

            if result.returncode == 0:
                print(f"\n{'='*70}")
                print("Procesamiento completado")
                print(f"{'='*70}\n")
            else:
                print(f"\nError en procesamiento (codigo: {result.returncode})\n")

        finally:
            self.processing = False


def watch_with_watchdog(input_dir, script_path):
    """Monitorea con watchdog (tiempo real)."""
    print(f"\nMonitor activo (watchdog)")
    print(f"Carpeta: {input_dir}")
    print("Presiona Ctrl+C para detener\n")

    observer = Observer()
    observer.schedule(ImageWatcher(script_path), str(input_dir), recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\nDeteniendo monitor...")
        observer.stop()
    observer.join()


def watch_with_polling(input_dir, script_path, interval=5):
    """Monitorea con polling (verificacion periodica)."""
    print(f"\nMonitor activo (polling cada {interval}s)")
    print(f"Carpeta: {input_dir}")
    print("Presiona Ctrl+C para detener\n")

    extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.heic'}
    last_files = set()

    # Obtener archivos iniciales
    for ext in extensions:
        last_files.update(input_dir.glob(f'*{ext}'))
        last_files.update(input_dir.glob(f'*{ext.upper()}'))

    print(f"Archivos iniciales: {len(last_files)}\n")

    try:
        while True:
            time.sleep(interval)

            # Obtener archivos actuales
            current_files = set()
            for ext in extensions:
                current_files.update(input_dir.glob(f'*{ext}'))
                current_files.update(input_dir.glob(f'*{ext.upper()}'))

            # Detectar nuevos
            new_files = current_files - last_files

            if new_files:
                print(f"\n{'='*70}")
                print(f"{len(new_files)} nueva(s) imagen(es) - {datetime.now().strftime('%H:%M:%S')}")
                for f in new_files:
                    print(f"  - {f.name}")
                print(f"{'='*70}\n")

                # Ejecutar procesador
                subprocess.run(
                    ['python', str(script_path)],
                    capture_output=False,
                    cwd=script_path.parent
                )

                print(f"\n{'='*70}")
                print("Procesamiento completado")
                print(f"{'='*70}\n")

                last_files = current_files

    except KeyboardInterrupt:
        print("\n\nDeteniendo monitor...")


def main():
    base_dir = Path(__file__).parent
    input_dir = base_dir / "input"
    script_path = base_dir / "capture_processor.py"

    print("\n" + "="*70)
    print("WEB CAPTURES ORGANIZER - MONITOR AUTOMATICO")
    print("="*70)

    if not input_dir.exists():
        print(f"\nError: {input_dir} no existe\n")
        return

    if not script_path.exists():
        print(f"\nError: {script_path} no existe\n")
        return

    # Elegir metodo
    if WATCHDOG_AVAILABLE:
        watch_with_watchdog(input_dir, script_path)
    else:
        watch_with_polling(input_dir, script_path, interval=5)


if __name__ == "__main__":
    main()
