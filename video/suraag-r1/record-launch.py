import subprocess
p=subprocess.Popen(['node','video/suraag-r1/record.mjs'],cwd='/home/sandbox/muletrace',stdout=open('/tmp/record.log','w'),stderr=subprocess.STDOUT,start_new_session=True)
print(p.pid)
