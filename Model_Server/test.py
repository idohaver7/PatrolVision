import requests

# הכתובת של השרת שלך (localhost)
url = 'http://127.0.0.1:6000/analyze'

# השם של התמונה ששמרת
image_path = '6.png'  # שים פה את התמונה שלך

try:
    print(f"📤 Sending {image_path} to server...")
    
    # פתיחת הקובץ ושליחתו בפורמט שהשרת מצפה לו ('frame')
    with open(image_path, 'rb') as img:
        files = {'frame': img}
        response = requests.post(url, files=files)

    # הדפסת התשובה שהגיעה מהשרת
    print("\n✅ Server Response:")
    print(response.json())

except FileNotFoundError:
    print("❌ Error: Could not find 'test.jpg'. Make sure the file is in this folder!")
except Exception as e:
    print(f"❌ Error: {e}")