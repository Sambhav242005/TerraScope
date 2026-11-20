"""Render the Seondha public-app recording with narration and protected caption bands."""
from pathlib import Path
import importlib.util
import json
import re
import subprocess
import difflib

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'artifacts/mp-video'
DEMO = ROOT / 'demo'
spec = importlib.util.spec_from_file_location('render', ROOT / 'scripts/render-challenge-demo.py')
render = importlib.util.module_from_spec(spec)
spec.loader.exec_module(render)
notes = json.loads((WORK / 'cues.json').read_text(encoding='utf-8'))
asr = json.loads((ROOT / 'artifacts/voice-review/narration.json').read_text(encoding='utf-8'))
words = [word for segment in asr for word in segment['words']]

def wrap(text):
    tokens = text.split()
    if len(text) <= 40:
        return [text]
    choices = [(' '.join(tokens[:i]), ' '.join(tokens[i:])) for i in range(1, len(tokens))]
    choices = [pair for pair in choices if max(map(len, pair)) <= 40]
    if not choices:
        raise ValueError('Caption needs another timed segment: ' + text)
    def cost(pair):
        left, right = pair
        return abs(len(left)-len(right)) + (20 if left.split()[-1].lower() in {'the','a','an','to','its','of','in'} else 0) - (10 if left[-1] in ',.' else 0)
    return list(min(choices, key=cost))

def split_text(text):
    # Keep clauses together where they fit two lines.
    natural_breaks = {
        'Imagine a team in Madhya Pradesh looking to store floodwater upstream of a village.': ['Imagine a team in Madhya Pradesh', 'looking to store floodwater upstream of a village.'],
        'TerraScope loads terrain, buildings and water, then downloads September 2024 rainfall and nearby river-flow history.': ['TerraScope loads terrain, buildings and water,', 'then downloads September 2024 rainfall and nearby river-flow history.'],
        'The card shows its footprint and a terrain-based volume estimate up to the spill rim.': ['The card shows its footprint', 'and a terrain-based volume estimate up to the spill rim.'],
    }
    if text in natural_breaks:
        return natural_breaks[text]
    if len(text) <= 76:
        return [text]
    candidates = [m.end() for m in re.finditer(r', | and | then | followed by | looking to | up to ', text)]
    valid = [i for i in candidates if 10 <= i <= 76 and len(text)-i <= 76]
    if valid:
        i = min(valid, key=lambda i: abs(i-len(text)/2))
        return [text[:i].strip(), text[i:].strip()]
    tokens = text.split()
    for i in range(len(tokens)//2, len(tokens)):
        left, right = ' '.join(tokens[:i]), ' '.join(tokens[i:])
        if len(left) <= 76 and len(right) <= 76:
            return [left,right]
    raise ValueError(text)

def normalized(text):
    return re.findall(r'[a-z0-9]+', text.lower())

def cues_for_note(note):
    parts = split_text(note['text'])
    if len(parts) == 1:
        return [(note['start'],note['end'],wrap(parts[0]))]
    spoken = [w for w in words if note['start']-.25 <= (w['start']+w['end'])/2 <= note['end']+.15]
    recognized = [(token,w['start']) for w in spoken for token in normalized(w['word'])]
    intended = normalized(note['text'])
    matcher = difflib.SequenceMatcher(None, intended, [t[0] for t in recognized], autojunk=False)
    mapping = {a+i:b+i for a,b,length in matcher.get_matching_blocks() for i in range(length)}
    offset = len(normalized(parts[0]))
    boundary = recognized[mapping[offset]][1] if offset in mapping else note['start']+(note['end']-note['start'])*len(parts[0].split())/len(note['text'].split())
    boundary = min(note['end']-.6,max(note['start']+.6,boundary))
    return [(note['start'],boundary,wrap(parts[0])),(boundary,note['end'],wrap(parts[1]))]

captions = [cue for note in notes for cue in cues_for_note(note)]
assert all(0 <= a < b <= 78 and len(lines)<=2 and max(map(len,lines))<=40 for a,b,lines in captions)

def stamp(t):
    ms=round(t*1000)
    return f'00:{ms//60000:02}:{ms//1000%60:02}.{ms%1000:03}'

def overlays(narrated):
    ass = render.ASS_HEADER
    for start,end,title in [(0,12,'TerraScope · A planning question in Madhya Pradesh'),(12,23,'Seondha · Sindh River area · Live public app'),(23,33,'Historical model data · September 2024 · UTC'),(33,40,'Terrain screening · Candidates near Seondha'),(40,52,'Geometry and field measurements'),(52,62,'Terrain profile · Plan a field survey'),(62,69,'Built with AI · Published with Embarko'),(69,78,'TerraScope · Explore the live map')]:
        ass += render.text(start,end,render.APP_X,64,title,26,bold=True)
    if narrated:
        ass += render.text(0,78,1760,68,'AI narration',22,color='BBDBB9',alignment=9)
        for start,end,lines in captions:
            ass += render.box(start,end,render.CAPTION_BOX,'081B1B')
            ass += render.text(start,end,960,871,r'\N'.join(lines),44,alignment=5)
    # A closing URL over a small area of map, with navigation and captions still visible.
    ass += render.box(69,78,(360,570,1560,730),'FFFDF7')
    ass += render.text(69,78,960,625,'terrascope-floods.embarko.app',54,alignment=5,color='123C32',bold=True)
    ass += render.text(69,78,960,686,'#DeployWithEmbarko',32,alignment=5,color='28654F',bold=True)
    return ass

raw = WORK / 'public-app.webm'
# Preparation uses real provider requests. The marker can occur after the first 20 seconds.
probe = render.run_ffmpeg('-t',120,'-i',raw,'-vf','fps=25,crop=2:2:1534:76','-pix_fmt','rgb24','-f','rawvideo','-',stdout=subprocess.PIPE)
markers = [i//12 for i in range(0,len(probe.stdout),12) if probe.stdout[i]>160 and probe.stdout[i+1]<55 and probe.stdout[i+2]>158]
if len(markers)<4:
    raise ValueError('Recording start marker was not captured')
trim = (markers[-1]+2)/25
exports = []
for narrated in (True,False):
    name = 'terrascope-submission' if narrated else 'terrascope-clean'
    (WORK/(name+'.ass')).write_text(overlays(narrated),encoding='utf-8')
    target = WORK/(name+'.mp4')
    audio = ['-i',WORK/'narration.wav','-map','0:v:0','-map','1:a:0','-af','aformat=channel_layouts=stereo,volume=2dB','-c:a','aac','-b:a','160k','-ar','48000','-disposition:a:0','default','-metadata:s:a:0','language=eng'] if narrated else ['-an']
    render.run_ffmpeg('-y','-ss',trim,'-i',raw,*audio,'-vf',f'fps=30,setsar=1,pad=1920:1080:160:104:color=0x102625,subtitles={name}.ass','-t',78,'-c:v','libx264','-preset','fast','-crf',18,'-pix_fmt','yuv420p','-movflags','+faststart',target,cwd=WORK)
    render.validate(target,narrated)
    exports.append(target)
ink = render.caption_ink(exports[0],captions)
sidecar = WORK/'terrascope-submission.vtt'
sidecar.write_text('WEBVTT\n\n'+'\n\n'.join(f'{stamp(a)} --> {stamp(b)} line:73% position:50% size:80% align:center\n'+'\n'.join(lines) for a,b,lines in captions)+'\n',encoding='utf-8')
exports.append(sidecar)
render.publish(exports,DEMO)
(WORK/'composition.json').write_text(json.dumps({'duration':78,'source':str(raw),'trim':trim,'captionCount':len(captions),'captionFrames':ink},indent=2),encoding='utf-8')
script = '# TerraScope · Madhya Pradesh film\n\n78 seconds. AI narration is embedded in terrascope-submission.mp4. Seondha is a town on the Sindh River. The flow source is a nearby model cell whose river identity remains unverified.\n\n'
for note in notes:
    script += f"**{stamp(note['start'])[3:]}–{stamp(note['end'])[3:]}**\n\n{note['text']}\n\n"
(DEMO/'script.md').write_text(script.rstrip()+'\n',encoding='utf-8')
boundaries = [0,12,23,33,40,52,62,69,78]
rehearsal = [{'start':a,'end':b,'text':' '.join(n['text'] for n in notes if a<=n['start']<b)} for a,b in zip(boundaries,boundaries[1:])]
(DEMO/'cues.js').write_text('window.DEMO_CUES = '+json.dumps(rehearsal,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print('Rendered and verified',len(captions),'captions and two 78-second MP exports.')
