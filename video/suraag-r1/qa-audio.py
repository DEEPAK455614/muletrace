import subprocess,json
from pathlib import Path
root=Path(__file__).resolve().parent
out={}
for p in sorted((root/'audio/suraag-narration-wav').glob('*.wav')):
 r=subprocess.run(['ffmpeg','-hide_banner','-i',str(p),'-af','volumedetect','-f','null','-'],capture_output=True,text=True)
 lines=[s.strip() for s in r.stderr.splitlines() if 'mean_volume' in s or 'max_volume' in s];out[p.name]=lines
print(json.dumps(out,indent=2));(root/'qa/audio-levels.json').write_text(json.dumps(out,indent=2))
