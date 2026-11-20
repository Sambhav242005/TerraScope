"""Create LinkedIn and Reels editions from the verified MP recording."""
from pathlib import Path
from tempfile import gettempdir
import importlib.util
import json
import re
import subprocess
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(gettempdir()) / 'terrascope-voice-runtime'))
import numpy as np

WORK = ROOT / 'artifacts/social-video'
WORK.mkdir(exist_ok=True)
DEMO = ROOT / 'demo'
spec = importlib.util.spec_from_file_location('render', ROOT / 'scripts/render-challenge-demo.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
raw = ROOT / 'artifacts/mp-video/public-app.webm'
trim = json.loads((ROOT / 'artifacts/mp-video/composition.json').read_text())['trim']

def run(*args, **kwargs):
    return r.run_ffmpeg(*args, **kwargs)

def load_wave(path):
    with wave.open(str(path), 'rb') as track:
        assert track.getsampwidth() == 2 and track.getnchannels() == 1 and track.getframerate() == 48000
        return np.frombuffer(track.readframes(track.getnframes()), '<i2').copy()

def save_wave(path, samples, rate=48000, channels=1):
    with wave.open(str(path), 'wb') as track:
        track.setparams((channels,2,rate,0,'NONE','not compressed'))
        track.writeframes(samples.astype('<i2').tobytes())

voice = load_wave(ROOT/'artifacts/mp-video/narration.wav')
cta = load_wave(WORK/'narration.wav')
linked = voice.copy()
linked[69*48000:round(72.3*48000)] = cta[69*48000:round(72.3*48000)]
save_wave(WORK/'linkedin-voice.wav',linked)

# Original ambient composition. Soft sine harmonics and slow envelopes keep the speech foregrounded.
rate = 24000
t = np.arange(78*rate,dtype=np.float64)/rate
music = np.zeros_like(t)
chords = [(146.832,174.614,220.0),(130.813,164.814,195.998),(110.0,130.813,164.814),(130.813,174.614,220.0)]
for index in range(13):
    begin = index*6
    phase = t-begin
    envelope = np.where((phase>=0)&(phase<10),np.sin(np.pi*np.clip(phase/10,0,1))**2,0)
    for i,freq in enumerate(chords[index%4]):
        music += envelope*(np.sin(2*np.pi*freq*t+i*.7)+.14*np.sin(4*np.pi*freq*t+i))*.04
music *= np.minimum(1,t/2)*np.minimum(1,(78-t)/4)
save_wave(WORK/'ambient.wav',np.rint(np.clip(music,-1,1)*32767),rate)
run('-y','-i',WORK/'ambient.wav','-af','loudnorm=I=-40:TP=-9:LRA=7','-ar',48000,'-ac',2,WORK/'music.wav')

def seconds(value):
    h,m,s = value.split(':')
    return int(h)*3600+int(m)*60+float(s)

captions = []
for block in re.split(r'\n\s*\n',(DEMO/'terrascope-submission.vtt').read_text(encoding='utf-8').strip())[1:]:
    timing,*lines = block.splitlines()
    start,_,end,*_ = timing.split()
    captions.append((seconds(start),seconds(end),' '.join(lines)))
assert all('Sainda' not in text for _,_,text in captions)
linked_captions = [(a,b,text) for a,b,text in captions if not (69<=a<72)]
new_cta = json.loads((WORK/'cues.json').read_text(encoding='utf-8'))[0]
linked_captions.append((new_cta['start'],new_cta['end'],new_cta['text']))
linked_captions.sort()

def lines(text,width=40):
    if len(text)<=width:
        return [text]
    parts = text.split()
    choices=[(' '.join(parts[:i]),' '.join(parts[i:])) for i in range(1,len(parts))]
    choices=[p for p in choices if max(map(len,p))<=width]
    if not choices:
        raise ValueError(text)
    return list(min(choices,key=lambda p:abs(len(p[0])-len(p[1]))))

def caption(ass,start,end,text,reel=False):
    box = (48,1420,948,1590) if reel else (360,776,1560,866)
    ass += r.box(start,end,box,'081B1B')
    ass += r.text(start,end,498 if reel else 960,1505 if reel else 821,r'\N'.join(lines(text)),48 if reel else 44,alignment=5)
    return ass

def sidecar(name,cues):
    def stamp(t):
        ms=round(t*1000)
        return f'00:{ms//60000:02}:{ms//1000%60:02}.{ms%1000:03}'
    body='WEBVTT\n\n'+'\n\n'.join(f'{stamp(a)} --> {stamp(b)} line:73% position:46% size:80% align:center\n'+'\n'.join(lines(text)) for a,b,text in cues)+'\n'
    (DEMO/name).write_text(body,encoding='utf-8')

linked_ass = r.ASS_HEADER
linked_ass += r.text(0,78,224,64,'TerraScope · Seondha, Madhya Pradesh',26,bold=True)
linked_ass += r.text(0,78,1696,68,'AI narration',22,color='BBDBB9',alignment=9)
for a,b,text in linked_captions:
    linked_ass=caption(linked_ass,a,b,text)
linked_ass += r.box(69,78,(360,555,1560,718),'FFFDF7')
linked_ass += r.text(69,78,960,600,'Explore TerraScope',48,color='123C32',alignment=5,bold=True)
linked_ass += r.text(69,78,960,652,'Link in the description',36,color='123C32',alignment=5)
linked_ass += r.text(69,78,960,695,'#DeployWithEmbarko',26,color='28654F',alignment=5)
(WORK/'linkedin.ass').write_text(linked_ass,encoding='utf-8')
run('-y','-ss',trim,'-i',raw,'-i',WORK/'linkedin-voice.wav','-i',WORK/'music.wav',
    '-filter_complex','[0:v]fps=30,scale=1472:662,setsar=1,pad=1920:1080:224:104:color=0x102625,subtitles=linkedin.ass[v];[1:a]aformat=channel_layouts=stereo,volume=2dB[voice];[voice][2:a]amix=inputs=2:normalize=0[a]',
    '-map','[v]','-map','[a]','-t',78,'-c:v','libx264','-preset','fast','-crf',18,'-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','160k','-ar',48000,'-disposition:a:0','default','-movflags','+faststart',DEMO/'terrascope-linkedin.mp4',cwd=WORK)
sidecar('terrascope-linkedin.vtt',linked_captions)

# Each cut retains complete speech clauses. The final hold makes a 45-second film.
windows=[(0,3.6),(3.962,9.2),(12.157,14.35),(14.689,22.9),(33.46,38.8),(40.46,45.8),(46.191,49.85),(52.46,54.3),(62.46,66.9),(72.357,76.3)]
clock=0
reel_captions=[]
reel_voice=np.zeros(45*48000,dtype=np.int16)
parts=[]
chapters=[]
for i,(a,b) in enumerate(windows):
    duration=b-a
    n=round(duration*30)
    duration=n/30
    begin=round(clock*48000)
    clip=voice[round(a*48000):round(a*48000)+round(duration*48000)]
    reel_voice[begin:begin+len(clip)]=clip
    for cs,ce,text in captions:
        if a<=cs<b:
            reel_captions.append((clock+cs-a,clock+min(ce,b)-a,text))
    if a<16: x,y=0,0
    elif a<23: x,y=110,160
    elif a<60: x,y=110,160
    else: x,y=650,110
    if i==len(windows)-1: duration=45-clock
    target=WORK/f'reel-{i}.mp4'
    # The top strip preserves full context. The lower view gently zooms into the active control.
    vf=(f'[0:v]fps=30,split=2[overview][focus];'
        f'[overview]scale=900:405[context];'
        f'[focus]crop=600:420:{x}:{y},zoompan=z=min(zoom+0.0002\\,1.06):x=iw/2-iw/zoom/2:y=ih/2-ih/zoom/2:d=1:s=900x630:fps=30[detail];'
        f'color=c=0x102625:s=1080x1920:r=30:d={duration}[bg];[bg][context]overlay=36:300[stage];[stage][detail]overlay=36:740[out]')
    if '--reuse-pictures' not in sys.argv or not target.exists():
        run('-y','-ss',trim+a,'-i',raw,'-filter_complex',vf,'-map','[out]','-an','-t',duration,
            '-c:v','libx264','-preset','fast','-crf',18,'-pix_fmt','yuv420p',target)
    parts.append(target)
    chapters.append({'sourceStart':a,'sourceEnd':b,'outputStart':clock,'outputEnd':clock+duration})
    clock+=duration
save_wave(WORK/'reel-voice.wav',reel_voice)
(WORK/'reel-parts.txt').write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),encoding='utf-8')
run('-y','-f','concat','-safe',0,'-i',WORK/'reel-parts.txt','-c','copy',WORK/'reel-picture.mp4')
reel_ass=r.ASS_HEADER.replace('PlayResX: 1920','PlayResX: 1080').replace('PlayResY: 1080','PlayResY: 1920')
reel_ass+=r.text(0,45,60,170,'TerraScope',54,bold=True)
reel_ass+=r.text(0,45,60,240,'Where should we survey first?',40,color='BBDBB9')
reel_ass+=r.text(0,45,936,180,'AI voice',22,color='BBDBB9',alignment=9)
for a,b,text in reel_captions:
    reel_ass=caption(reel_ass,a,b,text,True)
# Enlarge the actual selected candidate's key figures for a phone-sized player.
evidence=json.loads((ROOT/'artifacts/mp-video/recording.json').read_text(encoding='utf-8'))['evidence']
candidate=next(c for c in evidence['screen']['candidates'] if c['label']=='Terrain depression 597')
callouts=[
    (chapters[2]['outputStart'],chapters[2]['outputEnd'],'Seondha, Madhya Pradesh','Sindh River area'),
    (chapters[3]['outputStart']+5.5,chapters[3]['outputEnd'],'September 2024 history','Rainfall and nearby modeled flow'),
    (chapters[5]['outputStart'],chapters[5]['outputEnd'],f"Terrain estimate {candidate['geometricCapacityM3']:,.0f} m³",f"Footprint {candidate['footprintAreaM2']/10000:.1f} ha"),
    (chapters[6]['outputStart'],chapters[6]['outputEnd'],'Usable storage','Needs field measurements'),
    (chapters[7]['outputStart'],chapters[7]['outputEnd'],f"DEM rim {candidate['spillElevationM']:.0f} m · floor {candidate['minimumElevationM']:.0f} m",'Datum and survey accuracy unverified'),
]
for a,b,title,detail in callouts:
    reel_ass+=r.box(a,b,(48,1238,936,1370),'FFFDF7')
    reel_ass+=r.text(a,b,492,1280,title,44,color='123C32',alignment=5,bold=True)
    reel_ass+=r.text(a,b,492,1334,detail,34,color='28654F',alignment=5)
reel_ass+=r.box(39.8,45,(60,875,910,1235),'FFFDF7')
reel_ass+=r.text(39.8,45,485,955,'Explore TerraScope',52,color='123C32',alignment=5,bold=True)
reel_ass+=r.text(39.8,45,485,1060,'Link in bio',66,color='123C32',alignment=5,bold=True)
reel_ass+=r.text(39.8,45,485,1170,'#DeployWithEmbarko',32,color='28654F',alignment=5)
(WORK/'reel.ass').write_text(reel_ass,encoding='utf-8')
run('-y','-i',WORK/'reel-picture.mp4','-i',WORK/'reel-voice.wav','-i',WORK/'music.wav',
    '-filter_complex','[0:v]subtitles=reel.ass[v];[1:a]aformat=channel_layouts=stereo,volume=2dB[voice];[2:a]afade=t=out:st=41:d=4[music];[voice][music]amix=inputs=2:normalize=0[a]',
    '-map','[v]','-map','[a]','-t',45,'-c:v','libx264','-preset','fast','-crf',18,'-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','160k','-ar',48000,'-disposition:a:0','default','-movflags','+faststart',DEMO/'terrascope-reel.mp4',cwd=WORK)
sidecar('terrascope-reel.vtt',reel_captions)
(WORK/'edit.json').write_text(json.dumps({'windows':chapters,'linkedInSeconds':78,'reelSeconds':45,'musicTargetLUFS':-40,'reelCaptionBottomClearance':330,'linkedInCaptionBottomClearance':214},indent=2),encoding='utf-8')
run('-y','-ss',70,'-i',DEMO/'terrascope-submission.mp4','-frames:v',1,DEMO/'terrascope-linkedin-cover.png')
run('-y','-ss',34.2,'-i',DEMO/'terrascope-reel.mp4','-frames:v',1,DEMO/'terrascope-reel-cover.png')
print('Created LinkedIn and Reels exports, timed captions and covers.')
