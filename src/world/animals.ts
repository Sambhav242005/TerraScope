import * as T from 'three';
import {part,mat} from './valley';
import {height,isWater,surface,random,trees,walkable,riverX,walkingHeight} from './habitat';
import {speciesDefinitions,type SpeciesId} from '../engine/species';
export interface AnimalAgent { id:number;species:SpeciesId;mesh:T.Group;limbs:T.Object3D[];head:T.Object3D;target:T.Vector3;behavior:string;wait:number;phase:number;rng:()=>number; }
const palette={deer:0xb9783e,rabbit:0xc4ad91,fox:0xd96b2e,squirrel:0x99502c,songbird:0x418ca3,owl:0x90725b,fish:0xf3ab58,frog:0x70a246,turtle:0x557c47,glasswing:0x7de0da};
const materials=Object.fromEntries(Object.entries(palette).map(([k,v])=>[k,mat(v)])) as Record<string,T.Material>;
const cream=mat(0xffefd0),black=mat(0x202d26),antler=mat(0xe2c79e);
export function animal(species:SpeciesId,id:number):AnimalAgent{
 const mesh=new T.Group(),limbs:T.Object3D[]=[];const m=materials[species];let head:T.Object3D;
 const p=(x:number,y:number,z:number,a:number,b:number,c:number,material=m)=>part(mesh,material,x,y,z,a,b,c);
 if(['deer','rabbit','fox','squirrel'].includes(species)){
 const deer=species==='deer',rabbit=species==='rabbit';p(0,.65,0,.38,.42,.7);head=p(0,deer?1.15:.85,.65,.27,.3,.3);p(0,.76,.9,.18,.16,.28,cream);
 for(const side of [-1,1]){p(side*.2,deer?1.5:1.2,.65,.1,rabbit?.4:.2,.09);p(side*.22,deer?1.21:.95,.86,.04,.045,.03,black);for(const z of [-.4,.4])limbs.push(p(side*.26,.3,z,.09,deer?.38:.23,.1));}
 if(deer){for(const side of [-1,1]){p(side*.2,1.78,.6,.045,.45,.045,antler);for(let k=0;k<3;k++){const branch=p(side*(.25+k*.1),1.65+k*.16,.6,.18,.035,.035,antler);branch.rotation.z=side*.6;}}}
 else if(!rabbit){const tail=p(0,.6,-.9,species==='squirrel'?.3:.2,species==='squirrel'?.65:.2,.5);tail.rotation.x=-.4;p(0,.8,-1.2,.18,.2,.2,cream);}else p(0,.6,-.6,.2,.2,.2,cream);
 mesh.scale.setScalar(deer?1:species==='fox'?.8:.55);
 }else if(species==='songbird'||species==='owl'||species==='glasswing'){
 const butterfly=species==='glasswing';p(0,.2,0,.18,.3,.25);head=p(0,.5,.12,.23,.23,.22);p(0,.43,.36,.08,.08,.16,antler);
 for(const side of [-1,1]){const wing=p(side*.45,.25,0,butterfly?.48:.5,.06,butterfly?.4:.22);limbs.push(wing);p(side*.12,.52,.31,.055,.06,.04,black);}
 if(species==='owl'){p(-.17,.72,.1,.08,.15,.08);p(.17,.72,.1,.08,.15,.08);}mesh.scale.setScalar(butterfly?.6:species==='owl'?1:.65);
 }else if(species==='fish'){p(0,0,0,.15,.24,.45);head=p(0,0,.27,.15,.18,.2);limbs.push(p(0,0,-.45,.04,.3,.22));p(.13,.07,.3,.03,.04,.035,black);p(-.13,.07,.3,.03,.04,.035,black);}
 else {p(0,.25,0,species==='turtle'?.4:.25,.22,.45);head=p(0,.28,.48,.18,.18,.2);for(const side of [-1,1]){p(side*.1,.4,.57,.05,.07,.05,black);for(const z of [-.25,.25])limbs.push(p(side*.32,.1,z,.2,.1,.15));}mesh.scale.setScalar(species==='frog'?.65:.9);}
 mesh.traverse(o=>o.userData.agent=id);const rng=random(id*471+42);const agent={id,species,mesh,limbs,head,target:new T.Vector3(),behavior:'Exploring',wait:0,phase:rng()*6.28,rng};destination(agent,true);mesh.position.copy(agent.target);return agent;
}
function valid(species:SpeciesId,x:number,z:number){return species==='turtle'?(Math.abs(x)<17&&Math.abs(z)<17&&!trees.some(t=>Math.hypot(x-t.x,z-t.z)<.6)):species==='fish'?isWater(x,z)&&Math.abs(z)<17:walkable(x,z);}
export function destination(a:AnimalAgent,initial=false){
 let x=0,z=0;for(let k=0;k<300;k++){x=a.rng()*33-16.5;z=a.rng()*32-16;if(valid(a.species,x,z))break;}
 if(a.species==='frog'){x=7+ a.rng()*.8;z=7+a.rng()*2;}
 if(a.species==='turtle'){x=3+a.rng()*5;z=6+a.rng()*3;}
 const drinking=a.species==='deer'&&a.rng()<.3;if(drinking){z=a.rng()*24-12;x=riverX(z)+1.65;}
 if(['owl','songbird'].includes(a.species)&&a.rng()<.6){const tree=trees[Math.floor(a.rng()*trees.length)];x=tree.x+.85;z=tree.z;}
 if(a.species==='squirrel'){const tree=trees[a.id%trees.length];x=tree.x+.8;z=tree.z;}
 const flight=['songbird','owl','glasswing'].includes(a.species);a.target.set(x,a.species==='fish'?surface(z)-.22:height(x,z)+(flight?(a.species==='glasswing'?1:2.5):0),z);a.wait=initial?0:1+a.rng()*4;
 a.behavior=({deer:'Grazing',rabbit:'Foraging',fox:'Patrolling',squirrel:'Foraging near trees',songbird:'Foraging for insects',owl:'Perching',fish:'Schooling',frog:'Catching insects',turtle:'Basking',glasswing:'Visiting food plants'} as const)[a.species];if(drinking)a.behavior='Drinking at the river';if(a.species==='songbird'&&a.rng()<.5)a.behavior='Perching';
}
export function animateAnimals(agents:AnimalAgent[],dt:number,time:number){
 for(const a of agents){if(!a.mesh.visible)continue;const p=a.mesh.position;let speed=({deer:.7,rabbit:.9,fox:1,squirrel:.7,songbird:1.8,owl:1.3,fish:1.1,frog:.6,turtle:.22,glasswing:.9})[a.species];
 if(a.species==='rabbit'||a.species==='deer'){const predator=agents.find(b=>b.species==='fox'&&b.mesh.visible&&b.mesh.position.distanceTo(p)<3);if(predator){a.target.copy(p).add(p.clone().sub(predator.mesh.position).normalize().multiplyScalar(3));a.behavior='Fleeing';a.wait=0;speed*=2;}}
 if(a.species==='fox'){const prey=agents.find(b=>b.species==='rabbit'&&b.mesh.visible&&b.mesh.position.distanceTo(p)<4);if(prey){a.target.copy(prey.mesh.position);a.behavior='Stalking rabbits';a.wait=0;}}
 if(a.wait>0){a.wait-=dt;a.head.rotation.y=Math.sin(time+a.phase)*.3;if(a.species==='squirrel'){p.y=height(p.x,p.z)+Math.sin((a.wait/5)*Math.PI)*1.7;a.behavior='Climbing trunk';}if(a.species==='deer')a.head.rotation.x=.4;if(a.species==='turtle'&&isWater(p.x,p.z)){p.y=surface(p.z)-.05;a.behavior='Swimming';}continue;}
 const d=a.target.clone().sub(p);d.y=0;if(d.length()<.3){destination(a);continue;}d.normalize();if(['deer','songbird','fish'].includes(a.species)){const nearby=agents.filter(b=>b!==a&&b.species===a.species&&b.mesh.visible&&b.mesh.position.distanceTo(p)<5);if(nearby.length){const center=nearby.reduce((v,b)=>v.add(b.mesh.position),new T.Vector3()).divideScalar(nearby.length).sub(p);center.y=0;if(center.length()>1.2)d.add(center.normalize().multiplyScalar(.35)).normalize();}}const nx=p.x+d.x*speed*dt,nz=p.z+d.z*speed*dt;
 if(!valid(a.species,nx,nz)){destination(a);continue;}p.x=nx;p.z=nz;a.mesh.rotation.y=Math.atan2(d.x,d.z);const flight=['songbird','owl','glasswing'].includes(a.species);
 p.y=a.species==='fish'?surface(nz)-.22:walkingHeight(nx,nz)+(flight?(a.species==='glasswing'?1:2.5)+Math.sin(time*2+a.phase)*.2:0);
 if(a.species==='rabbit'||a.species==='frog')p.y+=Math.abs(Math.sin(time*7+a.phase))*.2;
 if(a.species==='turtle'){a.behavior=isWater(nx,nz)?'Swimming':'Moving along bank';if(isWater(nx,nz))p.y=surface(nz)-.05;}if(a.species==='owl')a.behavior='Hunting flight';if(a.species==='songbird')a.behavior='Flocking';
 a.limbs.forEach((limb,i)=>{if(flight)limb.rotation.z=Math.sin(time*(a.species==='glasswing'?20:8)+a.phase)*(i?1:-1)*.6;else limb.rotation.x=Math.sin(time*7+a.phase+i*Math.PI)*.4;});
 }
}
export function createAnimals(scene:T.Scene){const agents:AnimalAgent[]=[];for(const s of speciesDefinitions)for(let i=0;i<(s.id==='glasswing'?12:s.id==='fish'?10:4);i++){const a=animal(s.id,agents.length+1);agents.push(a);scene.add(a.mesh);}return agents;}

