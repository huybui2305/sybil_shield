import urllib.request
import json
import urllib.error

url = "http://localhost:8000/scan"
data = json.dumps({"wallet": "0xA856416a8a29c58963640F83753F6750fFBF12cF"}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

try:
    response = urllib.request.urlopen(req)
    print("SUCCESS")
    print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print("ERROR:", str(e))
