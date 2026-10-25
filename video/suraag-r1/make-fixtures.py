import csv,io
from pathlib import Path
root=Path(__file__).resolve().parents[2]
headers=['Transaction ID/UTR','Transaction Date/Time','Fraud Amount','Debit Bank Wallet Merchant','Debit Account Wallet UPI ID','Credit Account Wallet UPI ID','Complaint Acknowledgement ID','label']
rows=[]
for i in range(30):
 for j in range(8 if i%5==0 else 2):
  rows.append([f'HIST-{i:03d}-{j}',f'{j+1:02d}/09/2026 {10+j%8:02d}:00',5000+j*100,'Synthetic Bank',f'HIST-ACC-{i:03d}',f'HIST-DST-{(i+j)%40}','','1' if i%5==0 else '0'])
p=root/'data/historical/synthetic-training.csv'
with p.open('w') as f:
 w=csv.writer(f);w.writerow(headers);w.writerows(rows)
rows=[['TX-001','05/10/2026 10:00',90000,'Synthetic Bank','ACC-SOURCE-1','ACC-MULE-1','DEMO-C001',''],['TX-002','05/10/2026 10:10',70000,'Synthetic Bank','ACC-SOURCE-2','ACC-MULE-1','DEMO-C002',''],['TX-003','05/10/2026 10:30',85000,'Synthetic Bank','ACC-MULE-1','ACC-LAYER-1','DEMO-C001',''],['TX-004','05/10/2026 10:45',65000,'Synthetic Bank','ACC-MULE-1','ACC-LAYER-2','DEMO-C002',''],['TX-005','05/10/2026 11:00',80000,'Synthetic Bank','ACC-LAYER-1','ACC-EXIT-1','DEMO-C001',''],['TX-006','06/10/2026 09:00',12000,'Synthetic Bank','ACC-SALARY','ACC-RETAIL','','']]
with (root/'video/suraag-r1/synthetic-current.csv').open('w') as f:
 w=csv.writer(f);w.writerow(headers[:-1]);w.writerows([r[:-1] for r in rows])
(root/'video/suraag-r1/synthetic-training.csv').write_bytes(p.read_bytes())
print(p)
