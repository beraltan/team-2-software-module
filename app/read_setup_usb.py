"""Read the device's provisioning credentials locally; close the service first."""
import json
from pathlib import Path
import sys
import time
import serial
with serial.Serial('COM4',115200,timeout=.3) as device:
    time.sleep(2)
    device.reset_input_buffer()
    device.write(json.dumps({'command':'setup_info'}).encode()+b'\n')
    end=time.monotonic()+4
    count=0
    while time.monotonic()<end:
        try: data=json.loads(device.readline())
        except ValueError: continue
        if data.get('type')=='setup': print(json.dumps(data))
        elif data.get('type')=='radar': count+=1
    print('Radar messages:',count)
