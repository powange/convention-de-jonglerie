from PIL import Image, ImageDraw
import os, shutil
S='shots/'; O='img/'
crops = {  # nom: (haut, bas) en fraction de la hauteur
 '01-edition': (0, .47), '04-statistiques': (0, .44), '05-dernieres-validations': (0, .55),
 '14-julie-cochee': (.44, 1), '18-julie-validee-fiche': (.42, 1), '21-chloe-deja-validee': (.36, 1),
 '23-famille-deux-cochees': (.27, 1), '31-karim-groupe': (.27, 1),
 '30-karim-a-rembourser': (0, .66), '32-karim-rembourse': (0, .5), '33-lucas-deja-rembourse': (0, .5),
 '34-julien-a-rembourser': (0, .66), '82-vente-tarif-choisi': (.5, 1), '60-devalider-bouton': (0, .6),
}
for f in sorted(os.listdir(S)):
    n=f[:-4]; im=Image.open(S+f).convert('RGB')
    if n in crops:
        a,b=crops[n]; im=im.crop((0,int(a*im.height),im.width,int(b*im.height)))
    im.save(O+n+'.png')
def entoure(n, box):
    im=Image.open(O+n+'.png'); d=ImageDraw.Draw(im)
    d.rounded_rectangle(box, radius=14, outline=(239,68,68), width=6); im.save(O+n+'.png')
entoure('01-edition', (505, 490, 705, 572))
entoure('03-guichet', (56, 528, 724, 648))
entoure('03-guichet', (56, 664, 724, 744))
