from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess
root=Path(__file__).resolve().parent
subprocess.run(['pdftoppm','-png','-scale-to','1050','-singlefile',str(root/'report.pdf'),str(root/'qa/report')],check=True)
im=Image.new('RGB',(1920,1080),'#0b1322');p=Image.open(root/'qa/report.png').convert('RGB');p.thumbnail((760,950));im.paste(p,(1100,18));d=ImageDraw.Draw(im);f='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';d.text((80,160),'PERSISTED EVIDENCE',font=ImageFont.truetype(f,38),fill='#39d7ee');d.text((80,240),'PDF generated from this run',font=ImageFont.truetype(f,30),fill='white')
for y,t in enumerate(['Dataset checksum and model version','Run, rules and scoring versions','Findings with transaction references','Limitations beside the evidence','Synthetic data. Investigative leads only.']):d.text((80,330+y*60),t,font=ImageFont.truetype(f,24),fill='#bfccdd')
im.save(root/'qa/report-insert.png')
p=root/'recordings/05.concat';lines=p.read_text().splitlines();out=[];elapsed=0
for i in range(0,len(lines)-1,2):
 fline,dline=lines[i:i+2];dur=float(dline.split()[1]);
 if elapsed>=23.7:break
 take=min(dur,23.7-elapsed);out.extend([fline,'duration '+str(take)]);elapsed+=take
out.extend(["file '"+str(root/'qa/report-insert.png')+"'",'duration 5.94',"file '"+str(root/'qa/report-insert.png')+"'"]);p.write_text('\n'.join(out)+'\n')
