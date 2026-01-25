#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Script simple para mostrar estadísticas."""

import sys
from pathlib import Path

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from capture_processor import CaptureProcessor

processor = CaptureProcessor()

print("=" * 70)
print("📊 ESTADÍSTICAS DE WEB CAPTURES ORGANIZER")
print("=" * 70)
print()

image_files = processor.get_image_files()
processed_count = len([f for f in image_files if processor.is_file_processed(f)])
new_count = len([f for f in image_files if not processor.is_file_processed(f)])

print(f"📁 Carpeta: {processor.input_dir}")
print(f"📄 Salida: {processor.output_file}")
print()
print(f"🖼️  Total de imágenes: {len(image_files)}")
print(f"✅ Ya procesadas: {processed_count}")
print(f"🆕 Pendientes: {new_count}")
print()
print(f"🔍 OCR: {'✓ Habilitado' if processor.ocr_available else '✗ No disponible'}")
print()

if image_files:
    print("📋 ARCHIVOS:")
    for idx, f in enumerate(image_files[:10], 1):  # Mostrar solo primeros 10
        status = "✅" if processor.is_file_processed(f) else "🆕"
        size_kb = f.stat().st_size / 1024
        print(f"  {status} {f.name} ({size_kb:.1f} KB)")

    if len(image_files) > 10:
        print(f"  ... y {len(image_files) - 10} más")

print()
print("=" * 70)
