from PIL import Image
import os

source_icon = "src/icons/app_icon_v2.png"
output_dir = "src/icons"

sizes = [16, 48, 128]

try:
    img = Image.open(source_icon)
    for size in sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        output_path = os.path.join(output_dir, f"icon{size}.png")
        resized.save(output_path)
        print(f"Generated {output_path}")
except Exception as e:
    print(f"Error: {e}")
