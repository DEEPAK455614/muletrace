from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,os
root=Path(__file__).resolve().parent
labels=[('SURAAG','Financial crime investigation | Synthetic demonstration'),('BACKEND WORKSPACE','Validate, map, preview and confirm CSV import'),('HISTORICAL TRAINING','Versioned model | Random-split, transductive results only'),('CURRENT INVESTIGATION','Persisted run | Uncalibrated model + explainable rules'),('EVIDENCE & FOLLOW-THROUGH','Stored transactions | Bounded paths | Findings | PDF'),('SEPARATE SYNTHETIC WORKBENCH','Demo mode, not the uploaded backend investigation'),('METHOD, LIMITS & DELIVERY','Local full workflow | Hosted preview is frontend-only')]
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
for i,(title,sub) in enumerate(labels,1):
 im=Image.new('RGBA',(1920,92),(5,13,24,252));d=ImageDraw.Draw(im);d.rectangle((0,0,7,92),fill='#34d6ef');d.text((30,15),title,font=ImageFont.truetype(font,23),fill='#f5f7fc');d.text((30,48),sub,font=ImageFont.truetype(font,19),fill='#b8cadd');d.text((1640,34),f'{i:02d} / 07   DEMO',font=ImageFont.truetype(font,20),fill='#34d6ef');im.save(root/f'chapter{i:02d}.png')
# Keep real-time capture durations. A small close hold fills the final audio tail; no fabricated activity.
for i in range(1,8):
 n=f'{i:02d}';con=root/'recordings'/f'{n}.concat';audio=root/'audio/suraag-narration-wav'/f'{n}.wav'
 if not con.exists(): print('WAITING',n,flush=True);raise SystemExit(2)
 dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(audio)]))+1
 cmd=['ffmpeg','-y','-v','warning','-f','concat','-safe','0','-i',str(con),'-loop','1','-i',str(root/f'chapter{n}.png'),'-i',str(audio),'-filter_complex','[0:v]scale=1920:1080,setsar=1,tpad=stop_mode=clone:stop_duration=4[v];[v][1:v]overlay=0:988:shortest=1[out];[2:a]apad=pad_dur=1,alimiter=limit=0.95[a]','-map','[out]','-map','[a]','-t',str(dur),'-r','25','-c:v','libx264','-preset','ultrafast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',str(root/f'part{n}.mp4')]
 subprocess.run(cmd,check=True);print('ENCODED',n,dur,flush=True)
# Explicit PDF insert avoids concat-image decoder changes dropping the final still.
subprocess.run(['ffmpeg','-y','-v','warning','-i',str(root/'part05.mp4'),'-loop','1','-i',str(root/'qa/report-insert.jpg'),'-loop','1','-i',str(root/'chapter05.png'),'-filter_complex','[0:v]trim=duration=23.7,setpts=PTS-STARTPTS[a];[1:v]scale=1920:1080,setsar=1,trim=duration=5.94,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[c];[c][2:v]overlay=0:988:shortest=1[v]','-map','[v]','-t','29.64','-r','25','-an','-c:v','libx264','-preset','ultrafast','-crf','20','-pix_fmt','yuv420p',str(root/'part05-repaired.mp4')],check=True)
(root/'part05-repaired.mp4').replace(root/'part05.mp4')
(root/'parts.concat').write_text(''.join(f"file '{root}/part{i:02d}.mp4'\n" for i in range(1,8)))
import wave
with wave.open(str(root/'narration-joined.wav'),'wb') as out:
 out.setnchannels(1);out.setsampwidth(2);out.setframerate(24000)
 for i in range(1,8):
  with wave.open(str(root/'audio/suraag-narration-wav'/f'{i:02d}.wav'),'rb') as part:out.writeframes(part.readframes(part.getnframes()))
  out.writeframes(bytes(48000))
subprocess.run(['ffmpeg','-y','-v','warning','-f','concat','-safe','0','-i',str(root/'parts.concat'),'-i',str(root/'narration-joined.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:a','aac','-ar','48000','-b:a','160k','-movflags','+faststart',str(root/'Suraag-Short-Demo-1080p.mp4')],check=True)
print('DONE',flush=True)
