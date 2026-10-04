import urllib.request
import json

data = json.loads(urllib.request.urlopen("http://localhost:8080/api/comparison").read())
print(f"Time Step: {data['time']}")
print(f"Smart ML:   {data['smart_ml']['hits']} hits / {data['smart_ml']['totalScans']} scans ({data['smart_ml']['detectionRate']*100:.1f}%)")
print(f"Sequential: {data['sequential']['hits']} hits / {data['sequential']['totalScans']} scans ({data['sequential']['detectionRate']*100:.1f}%)")
print(f"Random:     {data['random']['hits']} hits / {data['random']['totalScans']} scans ({data['random']['detectionRate']*100:.1f}%)")
