import sys, io, qrcode
from PIL import Image
code, out = sys.argv[1], sys.argv[2]
if not code:
    # Une caméra qui ne filme aucun QR code : pour montrer le scanner au repos.
    from PIL import ImageDraw
    bg = Image.new('RGB', (640, 480), (60, 62, 70))
    ImageDraw.Draw(bg).rectangle((150, 90, 490, 390), outline=(200, 200, 200), width=3)
    buf = io.BytesIO(); bg.save(buf, 'JPEG'); open(out, 'wb').write(buf.getvalue() * 30)
    sys.exit(0)
img = qrcode.make(code, box_size=8, border=4).convert('RGB')
bg = Image.new('RGB', (640, 480), (235, 235, 230))
img = img.resize((380, 380))
bg.paste(img, ((640-380)//2, (480-380)//2))
buf = io.BytesIO(); bg.save(buf, 'JPEG', quality=90); f = buf.getvalue()
open(out, 'wb').write(f * 30)
img.save(out.replace('.mjpeg', '.png'))
