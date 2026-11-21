import sys
from PIL import Image
sortie, par = sys.argv[1], int(sys.argv[2])
ims = [Image.open(f) for f in sys.argv[3:]]
if not ims:
    sys.exit(0)
w = max(i.width for i in ims); h = max(i.height for i in ims)
g = 8
lignes = (len(ims) + par - 1) // par
cols = min(par, len(ims))
out = Image.new('RGB', (cols * w + (cols - 1) * g, lignes * h + (lignes - 1) * g), (255, 0, 255))
for k, im in enumerate(ims):
    out.paste(im, ((k % par) * (w + g), (k // par) * (h + g)))
out.save(sortie)
