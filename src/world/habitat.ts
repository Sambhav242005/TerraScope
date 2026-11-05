export type CameraMode = 'overview' | 'walk' | 'follow';
export interface HabitatMap { height(x:number,z:number):number; water(x:number,z:number):boolean; walkable(x:number,z:number):boolean }
export const riverX=(z:number)=>-3+Math.sin(z*.18)*3;
export const pond=(x:number,z:number)=>((x-1)/6)**2+((z-8)/4.5)**2;
export const isWater=(x:number,z:number)=>Math.abs(x-riverX(z))<1.3 || pond(x,z)<1;
export const surface=(z:number)=>.6+(20-z)*.035;
export function height(x:number,z:number){
 if(isWater(x,z))return surface(z)-.65;
 const bank=Math.min(Math.abs(x-riverX(z))/1.3,Math.sqrt(pond(x,z)));
 const upland=Math.max(0,-z-3)*.14+Math.max(0,Math.abs(x)-11)*.2;
 return surface(z)+Math.min(1.5,Math.max(0,bank-1)*2)+upland*Math.min(1,Math.max(0,bank-1))+Math.sin(x*.6)*Math.cos(z*.4)*.18*Math.min(1,bank);
}
export const trees=Array.from({length:65},(_,i)=>{const x=Math.sin(i*127.1+42)*18,z=Math.cos(i*311.7+23)*17;return{x,z,r:.45};}).filter(p=>!isWater(p.x,p.z)&&Math.abs(p.x-riverX(p.z))>3&&!(p.x>8&&p.z>5));
export const rocks=Array.from({length:35},(_,i)=>({x:Math.sin(i*93.7+4)*17,z:Math.cos(i*54.9+7)*16,r:.35})).filter(p=>!isWater(p.x,p.z));
export const onBridge=(x:number,z:number)=>Math.abs(z)<.65&&Math.abs(x-riverX(0))<2.1;
export const walkingHeight=(x:number,z:number)=>onBridge(x,z)?surface(0)+.46:height(x,z);
export const walkable=(x:number,z:number)=>Math.abs(x)<18&&Math.abs(z)<17&&(!isWater(x,z)||onBridge(x,z))&&!trees.some(t=>Math.hypot(x-t.x,z-t.z)<.7)&&!rocks.some(t=>Math.hypot(x-t.x,z-t.z)<t.r+.2)&&!(x>9&&x<13&&z>7&&z<11);
export const habitat:HabitatMap={height,water:isWater,walkable};
export function random(seed:number){let n=seed>>>0;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};}
