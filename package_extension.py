import os
import zipfile
import json
import re

def create_zip_package():
    # Read manifest to get version
    try:
        with open('manifest.json', 'r', encoding='utf-8') as f:
            manifest = json.load(f)
            version = manifest.get('version', 'unknown')
    except Exception as e:
        print(f"Error reading manifest.json: {e}")
        version = 'unknown'

    zip_filename = f"obsidian-smart-history-v{version}.zip"

    # Files and folders to exclude
    EXCLUDE_DIRS = {
        '.git',
        '.obsidian',
        '.vscode',
        '.idea',
        'docs',
        'node_modules',
        '__pycache__'
    }
    
    EXCLUDE_FILES = {
        '.gitignore',
        '.DS_Store',
        'Thumbs.db',
        'README.md',
        'PRIVACY.md',
        'resize_icons.py',
        'package_extension.py', # Exclude self
        zip_filename,           # Exclude self if already exists
        'obsidian-smart-history.zip' # Exclude old zip
    }

    print(f"Creating package: {zip_filename}...")

    try:
        with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk('.'):
                # Modify dirs in-place to skip excluded directories
                dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
                
                for file in files:
                    if file in EXCLUDE_FILES:
                        continue
                    if file.endswith('.zip') or file.endswith('.pyc'):
                        continue

                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, '.')
                    
                    print(f"  Adding: {arcname}")
                    zipf.write(file_path, arcname)
        
        print(f"\nSuccessfully created {zip_filename}")
        
    except Exception as e:
        print(f"Error creating zip file: {e}")

if __name__ == "__main__":
    create_zip_package()
