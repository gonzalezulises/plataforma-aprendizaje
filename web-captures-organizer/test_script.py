#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de prueba para Web Captures Organizer
Muestra estadísticas y permite reprocesar archivos.
"""

import sys
from pathlib import Path

# Configurar salida UTF-8 para Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Importar el procesador
from capture_processor import CaptureProcessor

def show_statistics():
    """Muestra estadísticas del proyecto."""
    processor = CaptureProcessor()

    print("=" * 70)
    print("📊 ESTADÍSTICAS DE WEB CAPTURES ORGANIZER")
    print("=" * 70)
    print()

    # Contar archivos
    image_files = processor.get_image_files()
    processed_count = len([f for f in image_files if processor.is_file_processed(f)])
    new_count = len([f for f in image_files if not processor.is_file_processed(f)])

    print(f"📁 Carpeta de entrada: {processor.input_dir}")
    print(f"📄 Documento de salida: {processor.output_file}")
    print()
    print(f"🖼️  Total de imágenes: {len(image_files)}")
    print(f"✅ Ya procesadas: {processed_count}")
    print(f"🆕 Pendientes: {new_count}")
    print()
    print(f"🔍 OCR disponible: {'✓ Sí' if processor.ocr_available else '✗ No'}")
    print()

    # Listar archivos
    if image_files:
        print("📋 LISTA DE ARCHIVOS:")
        for idx, f in enumerate(image_files, 1):
            status = "✅" if processor.is_file_processed(f) else "🆕"
            size_kb = f.stat().st_size / 1024
            print(f"  {status} {idx}. {f.name} ({size_kb:.1f} KB)")
    else:
        print("⚠️  No hay archivos en la carpeta input/")

    print()
    print("=" * 70)

def clear_cache():
    """Limpia el caché de archivos procesados."""
    processor = CaptureProcessor()

    print("🗑️  Limpiando caché de archivos procesados...")

    if processor.processed_files_json.exists():
        processor.processed_files_json.unlink()
        print("✅ Caché eliminado. Todos los archivos se reprocesarán.")
    else:
        print("⚠️  No hay caché para eliminar.")

def main():
    """Función principal."""
    print()
    print("=" * 70)
    print("WEB CAPTURES ORGANIZER - HERRAMIENTA DE PRUEBA")
    print("=" * 70)
    print()
    print("Opciones:")
    print("  1. Ver estadísticas")
    print("  2. Procesar capturas (solo nuevas)")
    print("  3. Reprocesar todo (limpiar caché + procesar)")
    print("  4. Salir")
    print()

    opcion = input("Elige una opción (1-4): ").strip()
    print()

    if opcion == "1":
        show_statistics()
    elif opcion == "2":
        processor = CaptureProcessor()
        processor.process_captures()
    elif opcion == "3":
        respuesta = input("⚠️  Esto reprocesará TODAS las imágenes. ¿Continuar? (s/n): ").strip().lower()
        if respuesta == 's':
            clear_cache()
            print()
            processor = CaptureProcessor()
            processor.process_captures()
        else:
            print("❌ Operación cancelada.")
    elif opcion == "4":
        print("👋 Saliendo...")
    else:
        print("❌ Opción inválida.")

    print()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Operación cancelada por el usuario.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
