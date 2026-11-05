import * as T from 'three';
import branches from './tree-branches.json';
import {height,isWater,riverX,surface,trees,rocks,random} from './habitat';
export const mat=(color:number)=>new T.MeshStandardMaterial({color,flatShading:true,roughness:.9});
const geo=new T.IcosahedronGeometry(1,0),box=new T.BoxGeometry(1,1,1);
export function part(parent:T.Object3D,material:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,shape='round') { const m=new T.Mesh(shape==='box'?box:geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m; }
export function buildValley(scene:T.Scene){
 const ground=new T.PlaneGeometry(40,40,80,80);ground.rotateX(-Math.PI/2);const pos=ground.attributes.position,colors=[];const green=new T.Color(),rng=random(42);
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,height(x,z));green.setHex(isWater(x,z)?0xbba76f:z<-10?0x708d53:0x88b951);green.multiplyScalar(.87+rng()*.23);colors.push(green.r,green.g,green.b);}
 ground.setAttribute('color',new T.Float32BufferAttribute(colors,3));ground.computeVertexNormals();const landMat=new T.MeshStandardMaterial({vertexColors:true,flatShading:true});const land=new T.Mesh(ground,landMat);land.receiveShadow=true;scene.add(land);
 const earth=mat(0x92704a);part(scene,earth,0,-2,0,40,4,40,'box');part(scene,mat(0xbb9760),0,-.5,0,39.9,1,39.9,'box');
 const waterMat=new T.MeshStandardMaterial({color:0x3ab8cc,transparent:true,opacity:.78,roughness:.25,metalness:.15,side:T.DoubleSide});const water=new T.Group();scene.add(water);
 for(let z=-20;z<20;z+=.4){const mesh=new T.Mesh(new T.PlaneGeometry(2.8,.65),waterMat);mesh.rotation.x=-Math.PI/2;mesh.rotation.z=-Math.atan((riverX(z+.4)-riverX(z))/.4);mesh.position.set(riverX(z),surface(z),z);water.add(mesh);}
 const lake=new T.Mesh(new T.CircleGeometry(1,40),waterMat);lake.rotation.x=-Math.PI/2;lake.scale.set(6,4.5,1);lake.position.set(1,surface(8)+.04,8);water.add(lake);
 const bark=mat(0x705137),crowns=[mat(0x2f7951),mat(0x649742),mat(0x94b84f)],conifer=mat(0x397b62);
 // Reuse three seeded EZ-Tree branch geometries; replace leaf billboards with dimensional crowns.
 const variants=branches.map(data=>new T.BufferGeometryLoader().parse(data));
 const foliage:T.Object3D[]=[];
 trees.forEach((p,i)=>{const group=new T.Group();group.position.set(p.x,height(p.x,p.z),p.z);scene.add(group);const scale=2.8+rng()*2;const trunk=new T.Mesh(variants[i%3],bark);trunk.scale.setScalar(scale/12);trunk.castShadow=true;group.add(trunk);
 if(i%3===0){for(let k=0;k<3;k++){const m=new T.Mesh(new T.ConeGeometry(1.25-k*.25,2.5,6),conifer);m.position.y=scale*.45+k*.85;m.castShadow=true;group.add(m);}}
 else {for(let k=0;k<3;k++)part(group,crowns[i%3],Math.sin(k*2)*.6,scale*.85+k*.35,Math.cos(k*2)*.5,1.5,1.4,1.4);}
 foliage.push(group);});
 const rock=mat(0x9c9d84);for(const p of rocks)part(scene,rock,p.x,height(p.x,p.z)+.12,p.z,p.r,.3,p.r);
 for(let i=0;i<9;i++){const x=i*4.6-18;part(scene,mat(i%2?0x8a8d77:0xa8a58d),x,3,-18,3,3+rng()*3,2.8);}
 const flowerMats=[mat(0xf4d875),mat(0xe99aaf),mat(0xf3efd9)];for(let i=0;i<190;i++){const x=rng()*35-17.5,z=rng()*34-17;if(!isWater(x,z)){part(scene,crowns[1],x,height(x,z)+.1,z,.09,.22,.09);part(scene,flowerMats[i%3],x,height(x,z)+.3,z,.12,.09,.12);}}
 // Field station and a terrain-following stepping path.
 const station=new T.Group();station.position.set(11,height(11,9),9);scene.add(station);part(station,mat(0xe5cc98),0,1,0,3,2,2.6,'box');const roof=new T.Mesh(new T.ConeGeometry(2.6,1.4,4),mat(0x9f5948));roof.position.y=2.7;roof.rotation.y=Math.PI/4;roof.castShadow=true;station.add(roof);part(station,mat(0x3b6864),0,1,1.32,.6,1.5,.05,'box');for(const x of [-.95,.95])part(station,mat(0xb4d6d0),x,1.3,1.32,.55,.6,.05,'box');
 for(let i=0;i<35;i++){const z=16-i*.8,x=9+Math.sin(z*.2)*2;part(scene,mat(0xcbb58a),x,height(x,z)+.02,z,1,.06,.7,'box');}
 // Footbridge over the stream.
 for(let i=0;i<14;i++)part(scene,bark,riverX(0)-2+i*.3,surface(0)+.4,0,.27,.12,1.7,'box');
 const rippleMat=mat(0x9ee6df);const ripples=Array.from({length:15},(_,i)=>part(scene,rippleMat,riverX(i*2-15),surface(i*2-15)+.04,i*2-15,.3,.015,.025,'box'));
 return{landMat,waterMat,water,foliage,ripples};
}
