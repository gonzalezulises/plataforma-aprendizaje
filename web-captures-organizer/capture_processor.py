#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Web Captures Organizer - Script Principal con OCR
Procesa capturas de pantalla de iPhone, extrae texto usando OCR, detecta URLs,
y genera un documento markdown organizado por categorías.
"""

import os
import sys
import shutil
import re
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Configurar salida UTF-8 para Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Importaciones opcionales para OCR
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("⚠ Pillow no está instalado. Instala con: pip install Pillow")

try:
    import pytesseract
    # Configurar ruta de Tesseract para Windows
    if sys.platform == 'win32':
        tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        if Path(tesseract_path).exists():
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    print("⚠ pytesseract no está instalado. Instala con: pip install pytesseract")

class CaptureProcessor:
    """Procesador de capturas de pantalla con OCR."""

    # Categorías predefinidas basadas en palabras clave
    CATEGORIES = {
        'Redes Sociales': ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'reddit', 'social'],
        'Desarrollo': ['github', 'stackoverflow', 'code', 'python', 'javascript', 'programming', 'dev', 'api'],
        'Noticias': ['news', 'article', 'blog', 'post', 'medium', 'noticia'],
        'Compras': ['amazon', 'ebay', 'shop', 'buy', 'cart', 'price', 'compra', 'tienda'],
        'Productividad': ['notion', 'trello', 'asana', 'calendar', 'task', 'todo', 'meeting'],
        'Educación': ['course', 'tutorial', 'learn', 'education', 'udemy', 'coursera', 'clase'],
        'Entretenimiento': ['youtube', 'netflix', 'spotify', 'music', 'video', 'stream'],
        'Finanzas': ['bank', 'payment', 'invoice', 'finance', 'money', 'precio', 'pago'],
    }

    def __init__(self, input_dir="input", processed_dir="processed", output_file="resources.md"):
        """
        Inicializa el procesador de capturas.

        Args:
            input_dir: Directorio con las capturas a procesar
            processed_dir: Directorio donde se mueven las capturas procesadas (ya no se usa)
            output_file: Archivo markdown de salida
        """
        self.base_dir = Path(__file__).parent
        self.input_dir = self.base_dir / input_dir
        self.processed_dir = self.base_dir / processed_dir  # Mantenido para compatibilidad
        self.output_file = self.base_dir / output_file
        self.processed_files_json = self.base_dir / ".processed_files.json"

        # Crear directorios si no existen
        self.input_dir.mkdir(exist_ok=True)

        # Verificar disponibilidad de OCR
        self.ocr_available = PIL_AVAILABLE and TESSERACT_AVAILABLE

        # Cargar lista de archivos ya procesados
        self.processed_files = self.load_processed_files()

    def get_image_files(self):
        """Obtiene lista de archivos de imagen en el directorio input."""
        extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.heic']
        files = []

        for ext in extensions:
            files.extend(self.input_dir.glob(f'*{ext}'))
            files.extend(self.input_dir.glob(f'*{ext.upper()}'))

        return sorted(files, key=lambda x: x.stat().st_mtime)

    def extract_text_from_image(self, image_path):
        """
        Extrae texto de una imagen usando OCR.

        Args:
            image_path: Ruta a la imagen

        Returns:
            str con el texto extraído
        """
        if not self.ocr_available:
            return None

        try:
            image = Image.open(image_path)

            # Convertir HEIC a RGB si es necesario
            if image.mode in ('RGBA', 'LA', 'P'):
                image = image.convert('RGB')

            # Extraer texto usando pytesseract
            text = pytesseract.image_to_string(image, lang='spa+eng')
            return text.strip()

        except Exception as e:
            print(f"  ⚠ Error en OCR: {e}")
            return None

    def extract_urls(self, text):
        """
        Extrae URLs del texto.

        Args:
            text: Texto donde buscar URLs

        Returns:
            list de URLs encontradas
        """
        if not text:
            return []

        # Patrón para detectar URLs
        url_pattern = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        urls = re.findall(url_pattern, text)

        # También buscar dominios sin protocolo
        domain_pattern = r'(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?'
        domains = re.findall(domain_pattern, text)

        # Combinar y limpiar URLs
        all_urls = list(set(urls + [d if d.startswith('http') else f'https://{d}' for d in domains]))

        return all_urls

    def categorize_content(self, text, urls):
        """
        Categoriza el contenido basándose en palabras clave.

        Args:
            text: Texto extraído
            urls: URLs encontradas

        Returns:
            str con la categoría detectada
        """
        if not text and not urls:
            return 'Sin categoría'

        # Combinar texto y URLs para análisis
        content = (text or '').lower() + ' ' + ' '.join(urls or []).lower()

        # Buscar coincidencias con categorías
        scores = defaultdict(int)
        for category, keywords in self.CATEGORIES.items():
            for keyword in keywords:
                if keyword.lower() in content:
                    scores[category] += 1

        # Devolver categoría con más coincidencias
        if scores:
            return max(scores.items(), key=lambda x: x[1])[0]

        return 'Otros'

    def extract_info_from_filename(self, filename):
        """
        Extrae información del nombre del archivo.

        Args:
            filename: Nombre del archivo

        Returns:
            dict con información extraída
        """
        info = {
            'original_name': filename.name,
            'date': None,
            'description': filename.stem
        }

        # Intentar extraer fecha del nombre
        date_patterns = [
            r'(\d{4}[-_]\d{2}[-_]\d{2})',  # YYYY-MM-DD
            r'(\d{2}[-_]\d{2}[-_]\d{4})',  # DD-MM-YYYY
            r'(\d{8})',                     # YYYYMMDD
        ]

        for pattern in date_patterns:
            match = re.search(pattern, filename.name)
            if match:
                info['date'] = match.group(1)
                break

        # Si no hay fecha, usar fecha de modificación
        if not info['date']:
            mod_time = datetime.fromtimestamp(filename.stat().st_mtime)
            info['date'] = mod_time.strftime('%Y-%m-%d %H:%M:%S')

        return info

    def load_processed_files(self):
        """Carga la lista de archivos ya procesados desde el archivo JSON."""
        if self.processed_files_json.exists():
            try:
                with open(self.processed_files_json, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, Exception) as e:
                print(f"⚠ Error cargando .processed_files.json: {e}")
                return {}
        return {}

    def save_processed_files(self):
        """Guarda la lista de archivos procesados al archivo JSON."""
        try:
            with open(self.processed_files_json, 'w', encoding='utf-8') as f:
                json.dump(self.processed_files, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"⚠ Error guardando .processed_files.json: {e}")

    def is_file_processed(self, image_file):
        """Verifica si un archivo ya fue procesado."""
        file_key = image_file.name
        file_mtime = image_file.stat().st_mtime
        
        if file_key in self.processed_files:
            # Verificar si la fecha de modificación es la misma
            stored_mtime = self.processed_files[file_key].get('mtime')
            if stored_mtime and stored_mtime == file_mtime:
                return True
        return False

    def mark_file_as_processed(self, image_file, extracted_text=None, urls=None, category=None):
        """Marca un archivo como procesado y guarda sus datos."""
        file_key = image_file.name
        file_mtime = image_file.stat().st_mtime
        processed_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        self.processed_files[file_key] = {
            'mtime': file_mtime,
            'processed_date': processed_date,
            'path': str(image_file.relative_to(self.base_dir)),
            'text': extracted_text or '',
            'urls': urls or [],
            'category': category or 'Otros'
        }

    def process_captures(self):
        """Procesa todas las capturas y genera el documento markdown."""
        print("=" * 70)
        print("WEB CAPTURES ORGANIZER - PROCESADOR CON OCR")
        print("=" * 70)
        print()

        if not self.ocr_available:
            print("⚠ MODO BÁSICO: OCR no disponible")
            print("  Para habilitar OCR, instala:")
            print("    pip install Pillow pytesseract")
            print()
        else:
            print("✓ OCR habilitado (Tesseract)")
            print()

        # Obtener archivos de imagen
        image_files = self.get_image_files()

        if not image_files:
            print(f"No se encontraron imágenes en: {self.input_dir}")
            print("Coloca tus capturas de pantalla en la carpeta 'input/' y vuelve a ejecutar.")
            return

        print(f"Encontradas {len(image_files)} capturas de pantalla")
        
        # Filtrar archivos nuevos
        new_files = [f for f in image_files if not self.is_file_processed(f)]
        skipped_files = [f for f in image_files if self.is_file_processed(f)]
        
        print(f"Archivos nuevos para procesar: {len(new_files)}")
        print(f"Archivos ya procesados (se saltarán): {len(skipped_files)}")
        print()
        
        if skipped_files:
            print("📋 ARCHIVOS SALTADOS (ya procesados):")
            for skipped_file in skipped_files:
                processed_date = self.processed_files.get(skipped_file.name, {}).get('processed_date', 'fecha desconocida')
                print(f"  ⏭ {skipped_file.name} (procesado el {processed_date})")
            print()
        
        if not new_files:
            print("✅ Todos los archivos ya fueron procesados anteriormente.")
            print("   No hay nada nuevo que procesar.")
            return

        print(f"🔄 PROCESANDO {len(new_files)} ARCHIVOS NUEVOS:")
        print()

        # Diccionario para organizar por categorías
        categorized_captures = defaultdict(list)

        # Procesar solo archivos nuevos
        for idx, image_file in enumerate(new_files, 1):
            print(f"[{idx}/{len(new_files)}] ✅ Procesando: {image_file.name}")

            # Extraer información básica
            info = self.extract_info_from_filename(image_file)

            # Extraer texto con OCR
            extracted_text = None
            if self.ocr_available:
                print(f"  → Ejecutando OCR...")
                extracted_text = self.extract_text_from_image(image_file)
                if extracted_text:
                    word_count = len(extracted_text.split())
                    print(f"  → Texto extraído: {word_count} palabras")
                else:
                    print(f"  → No se pudo extraer texto")

            # Extraer URLs
            urls = self.extract_urls(extracted_text) if extracted_text else []
            if urls:
                print(f"  → URLs encontradas: {len(urls)}")

            # Categorizar
            category = self.categorize_content(extracted_text, urls)
            print(f"  → Categoría: {category}")

            # Guardar información
            capture_data = {
                'info': info,
                'text': extracted_text,
                'urls': urls,
                'file': image_file
            }
            categorized_captures[category].append(capture_data)

            # Marcar archivo como procesado (sin moverlo) y guardar datos
            self.mark_file_as_processed(image_file, extracted_text, urls, category)
            print(f"  → ✅ Marcado como procesado (permanece en input/)")
            print()

        # Guardar lista de archivos procesados
        self.save_processed_files()
        
        # Generar documento markdown con TODOS los archivos (incluyendo los ya procesados)
        all_categorized_captures = self.generate_all_categorized_captures()
        self.generate_markdown(all_categorized_captures, len(image_files))

        print("=" * 70)
        print(f"✅ PROCESO COMPLETADO!")
        print(f"✓ {len(new_files)} capturas procesadas en esta ejecución")
        print(f"✓ {len(skipped_files)} capturas saltadas (ya procesadas)")
        print(f"✓ {len(image_files)} capturas totales en input/")
        print(f"✓ {len(all_categorized_captures)} categorías en documento final")
        print(f"✓ Documento actualizado: {self.output_file.name}")
        print(f"✓ Registro actualizado: .processed_files.json")
        print("=" * 70)

    def generate_all_categorized_captures(self):
        """Genera categorización de TODOS los archivos para el documento final."""
        print("📝 Generando documento con todos los archivos...")

        # Obtener todos los archivos
        all_files = self.get_image_files()
        categorized_captures = defaultdict(list)

        for image_file in all_files:
            # Extraer información básica
            info = self.extract_info_from_filename(image_file)

            # Para archivos ya procesados, usar datos guardados
            if self.is_file_processed(image_file):
                file_data = self.processed_files.get(image_file.name, {})
                extracted_text = file_data.get('text', '')
                urls = file_data.get('urls', [])
                category = file_data.get('category', 'Otros')
            else:
                # Este caso no debería ocurrir aquí, pero por seguridad
                extracted_text = None
                if self.ocr_available:
                    extracted_text = self.extract_text_from_image(image_file)
                urls = self.extract_urls(extracted_text) if extracted_text else []
                category = self.categorize_content(extracted_text, urls)

            capture_data = {
                'info': info,
                'text': extracted_text,
                'urls': urls,
                'file': image_file
            }
            categorized_captures[category].append(capture_data)

        return categorized_captures

    def generate_markdown(self, categorized_captures, total_count):
        """
        Genera el documento markdown organizado por categorías.

        Args:
            categorized_captures: Dict con capturas organizadas por categoría
            total_count: Total de capturas procesadas
        """
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        markdown_content = f"""# Web Captures - Recursos Organizados con OCR

**Fecha de generación:** {now}
**Total de capturas:** {total_count}
**Categorías:** {len(categorized_captures)}
**OCR habilitado:** {'✓ Sí' if self.ocr_available else '✗ No'}

---

## Índice de Categorías

"""
        # Generar índice
        for category in sorted(categorized_captures.keys()):
            count = len(categorized_captures[category])
            markdown_content += f"- [{category}](#{category.lower().replace(' ', '-')}) ({count} capturas)\n"

        markdown_content += "\n---\n\n"

        # Generar contenido por categoría
        for category in sorted(categorized_captures.keys()):
            captures = categorized_captures[category]
            markdown_content += f"## {category}\n\n"
            markdown_content += f"*{len(captures)} captura(s) en esta categoría*\n\n"

            for idx, capture in enumerate(captures, 1):
                info = capture['info']
                text = capture['text']
                urls = capture['urls']
                image_file = capture['file']

                markdown_content += f"### {idx}. {info['description']}\n\n"
                markdown_content += f"**Fecha:** {info['date']} | **Archivo:** `{info['original_name']}`\n\n"

                # URLs encontradas
                if urls:
                    markdown_content += f"**URLs ({len(urls)}):**\n"
                    for url in urls:
                        markdown_content += f"- {url}\n"
                    markdown_content += "\n"

                # Texto extraído
                if text and text != "[Archivo procesado previamente - OCR no ejecutado]":
                    markdown_content += f"**Texto extraído:**\n```\n{text}\n```\n\n"

                markdown_content += "---\n\n"

        # Escribir archivo
        with open(self.output_file, 'w', encoding='utf-8') as f:
            f.write(markdown_content)


def main():
    """Función principal."""
    print()
    processor = CaptureProcessor()
    processor.process_captures()
    print()


if __name__ == "__main__":
    main()
