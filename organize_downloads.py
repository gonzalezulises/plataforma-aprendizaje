#!/usr/bin/env python3
"""
Script para organizar archivos de la carpeta Downloads por tipo.
Clasifica archivos en subcarpetas: Imágenes, Documentos, Videos, Audio, Archivos y Otros.
"""

import os
import shutil
from pathlib import Path

# Definir categorías y sus extensiones
CATEGORIAS = {
    'Imágenes': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff', '.tif'],
    'Documentos': ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.csv', '.rtf'],
    'Videos': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg'],
    'Audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus'],
    'Archivos': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso'],
    'Programas': ['.exe', '.msi', '.dmg', '.apk', '.deb', '.rpm'],
    'Otros': []  # Para archivos que no coincidan con ninguna categoría
}

def obtener_carpeta_downloads():
    """Obtiene la ruta de la carpeta Downloads del usuario."""
    return str(Path.home() / "Downloads")

def obtener_categoria(extension):
    """Determina la categoría de un archivo según su extensión."""
    extension = extension.lower()
    for categoria, extensiones in CATEGORIAS.items():
        if extension in extensiones:
            return categoria
    return 'Otros'

def crear_carpetas(ruta_base):
    """Crea las carpetas de categorías si no existen."""
    carpetas_creadas = []
    for categoria in CATEGORIAS.keys():
        ruta_carpeta = os.path.join(ruta_base, categoria)
        if not os.path.exists(ruta_carpeta):
            os.makedirs(ruta_carpeta)
            carpetas_creadas.append(categoria)
    return carpetas_creadas

def organizar_archivos(ruta_downloads, modo_prueba=True):
    """
    Organiza los archivos de Downloads en subcarpetas por tipo.

    Args:
        ruta_downloads: Ruta a la carpeta Downloads
        modo_prueba: Si es True, solo muestra qué haría sin mover archivos
    """
    if not os.path.exists(ruta_downloads):
        print(f"Error: La carpeta {ruta_downloads} no existe.")
        return

    print(f"\n{'=' * 60}")
    print(f"Organizando archivos en: {ruta_downloads}")
    print(f"Modo: {'PRUEBA (no se moverán archivos)' if modo_prueba else 'EJECUCIÓN REAL'}")
    print(f"{'=' * 60}\n")

    # Crear carpetas de categorías
    carpetas_creadas = crear_carpetas(ruta_downloads)
    if carpetas_creadas:
        print(f"Carpetas creadas: {', '.join(carpetas_creadas)}\n")

    # Contador de archivos por categoría
    contadores = {categoria: 0 for categoria in CATEGORIAS.keys()}
    archivos_procesados = 0

    # Obtener lista de archivos (sin subcarpetas)
    try:
        items = os.listdir(ruta_downloads)
    except PermissionError:
        print("Error: No tienes permisos para acceder a la carpeta Downloads.")
        return

    for item in items:
        ruta_completa = os.path.join(ruta_downloads, item)

        # Saltar si es un directorio o si es una de nuestras carpetas de categorías
        if os.path.isdir(ruta_completa):
            continue

        # Obtener extensión y categoría
        _, extension = os.path.splitext(item)
        categoria = obtener_categoria(extension)

        # Construir ruta de destino
        carpeta_destino = os.path.join(ruta_downloads, categoria)
        ruta_destino = os.path.join(carpeta_destino, item)

        # Manejar archivos con el mismo nombre
        if os.path.exists(ruta_destino):
            nombre_base, ext = os.path.splitext(item)
            contador = 1
            while os.path.exists(ruta_destino):
                nuevo_nombre = f"{nombre_base}_{contador}{ext}"
                ruta_destino = os.path.join(carpeta_destino, nuevo_nombre)
                contador += 1

        # Mostrar acción
        print(f"[{categoria}] {item}")

        # Mover archivo (solo si no es modo prueba)
        if not modo_prueba:
            try:
                shutil.move(ruta_completa, ruta_destino)
                contadores[categoria] += 1
                archivos_procesados += 1
            except Exception as e:
                print(f"  ⚠ Error al mover: {e}")
        else:
            contadores[categoria] += 1
            archivos_procesados += 1

    # Resumen
    print(f"\n{'=' * 60}")
    print("RESUMEN:")
    print(f"{'=' * 60}")
    for categoria, cantidad in contadores.items():
        if cantidad > 0:
            print(f"  {categoria}: {cantidad} archivo(s)")
    print(f"\nTotal de archivos procesados: {archivos_procesados}")

    if modo_prueba:
        print("\n⚠ MODO PRUEBA: No se movió ningún archivo.")
        print("Ejecuta con modo_prueba=False para organizar realmente.")
    else:
        print("\n✓ Organización completada exitosamente!")

def main():
    """Función principal."""
    print("=" * 60)
    print("ORGANIZADOR DE ARCHIVOS - CARPETA DOWNLOADS")
    print("=" * 60)

    ruta_downloads = obtener_carpeta_downloads()

    # Preguntar al usuario si quiere ejecutar en modo prueba
    print(f"\nCarpeta a organizar: {ruta_downloads}")
    print("\nOpciones:")
    print("1. Modo prueba (ver qué haría sin mover archivos)")
    print("2. Organizar archivos realmente")
    print("3. Salir")

    while True:
        opcion = input("\nElige una opción (1/2/3): ").strip()

        if opcion == '1':
            organizar_archivos(ruta_downloads, modo_prueba=True)
            break
        elif opcion == '2':
            confirmacion = input("\n¿Estás seguro de que quieres organizar los archivos? (s/n): ").strip().lower()
            if confirmacion == 's':
                organizar_archivos(ruta_downloads, modo_prueba=False)
            else:
                print("Operación cancelada.")
            break
        elif opcion == '3':
            print("Saliendo...")
            break
        else:
            print("Opción inválida. Por favor elige 1, 2 o 3.")

if __name__ == "__main__":
    main()
