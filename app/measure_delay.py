"""Analyse manually annotated crossing/display frames from one >=60fps recording."""
import argparse
import csv
import json
from pathlib import Path


def percentile(values, p):
    values=sorted(values);i=(len(values)-1)*p;lo=int(i);hi=min(lo+1,len(values)-1)
    return values[lo]+(values[hi]-values[lo])*(i-lo)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv_file',help='CSV columns: crossing_frame,display_frame,fps')
    args=parser.parse_args()
    delays=[]
    with open(args.csv_file,newline='') as f:
        for row in csv.DictReader(f):
            crossing,display,fps=float(row['crossing_frame']),float(row['display_frame']),float(row['fps'])
            if fps<60 or display<crossing:raise ValueError('Use >=60fps and display frame >= crossing frame')
            delays.append((display-crossing)*1000/fps)
    if not delays:raise ValueError('No annotated crossings')
    report=dict(crossings=len(delays),median_ms=percentile(delays,.5),p95_ms=percentile(delays,.95),
                acceptance_target_ms=300,passes_target=percentile(delays,.95)<=300,
                meets_20_crossing_protocol=len(delays)>=20,
                method='Physical and screen crossing frames from the SAME recording; no cross-device clock subtraction.')
    Path(args.csv_file).with_suffix('.results.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
