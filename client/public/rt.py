from PIL import Image
img = Image.open("logo192.png")
resized_img = img.resize((192, 192))
resized_img.save("logo192.png")