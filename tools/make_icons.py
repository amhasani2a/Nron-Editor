"""Derive icons from the supplied artwork; never redraw the user's brand."""
from PIL import Image
from pathlib import Path
source=Image.open('branding/original.png').convert('RGB')
# Crop includes the entire mark and underscore; keep breathing room on all OSes.
mark=source.crop((390,410,910,860))
canvas=Image.new('RGB',(1024,1024),(9,9,13))
mark.thumbnail((780,680),Image.Resampling.LANCZOS)
canvas.paste(mark,((1024-mark.width)//2,(1024-mark.height)//2))
out=Path('src-tauri/icons');out.mkdir(exist_ok=True,parents=True)
for n,name in [(32,'32x32.png'),(128,'128x128.png'),(256,'128x128@2x.png'),(512,'icon.png')]:canvas.resize((n,n),Image.Resampling.LANCZOS).save(out/name)
canvas.save(out/'icon.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
canvas.save(out/'icon.icns')
canvas.resize((96,96),Image.Resampling.LANCZOS).save('src/assets/logo.png')
