import * as THREE from 'three';
import { MercatorCoordinate, type Map as GeographicMap, type CustomLayerInterface, type CustomRenderMethodInput, type PointLike } from 'maplibre-gl';
import type { Intervention } from './intervention';

/** Procedural proposal assets. Metres, x east/y north/z up. No energy model. */
export function buildRenewableModel(item: Intervention): THREE.Group {
  const group = new THREE.Group(); group.name = item.id;
  const metal = new THREE.MeshStandardMaterial({color:0xc8d1d5,roughness:0.55,metalness:0.45});
  const box = (x:number,y:number,z:number,material:THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(x,y,z),material);
  if (item.kind === 'solar_array') {
    const side = Math.sqrt(item.areaM2); const cols=8, rows=6;
    const width=side/10, depth=side/10; const tilt=20*Math.PI/180;
    const blue = new THREE.MeshStandardMaterial({color:0x12345b,roughness:0.32,metalness:0.35});
    const frame = new THREE.InstancedMesh(new THREE.BoxGeometry(width,depth,0.15),metal,cols*rows);
    const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(width-.3,depth-.3,.07),blue,cols*rows);
    const supports = new THREE.InstancedMesh(new THREE.BoxGeometry(.25,.25,2.5),metal,cols*rows*2);
    const helper = new THREE.Object3D();const grid:number[]=[];
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const i=r*cols+c, x=(c-(cols-1)/2)*side/cols, y=(r-(rows-1)/2)*side/rows;
      helper.position.set(x,y,3.1); helper.rotation.set(tilt,0,0);helper.updateMatrix();frame.setMatrixAt(i,helper.matrix);
      helper.position.z+=.12;helper.updateMatrix();panels.setMatrixAt(i,helper.matrix);
      for(let k=0;k<2;k++){helper.position.set(x+(k?1:-1)*width*.35,y,1.25);helper.rotation.set(0,0,0);helper.updateMatrix();supports.setMatrixAt(i*2+k,helper.matrix);}
      // Cell seams share one line mesh for the entire installation.
      for(let a=0;a<=8;a++){const u=-width/2+a*width/8;for(const v of [-depth/2,depth/2])grid.push(x+u,y+v*Math.cos(tilt),3.35+v*Math.sin(tilt));}
      for(let a=0;a<=4;a++){const v=-depth/2+a*depth/4;for(const u of [-width/2,width/2])grid.push(x+u,y+v*Math.cos(tilt),3.35+v*Math.sin(tilt));}
    }
    const lines = new THREE.BufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute(grid,3));
    group.add(frame,panels,supports,new THREE.LineSegments(lines,new THREE.LineBasicMaterial({color:0x718cac})));
    group.userData={kind:item.kind,tableCount:rows*cols,illustrative:true};
  } else if(item.kind === 'wind_turbine') {
    const white = new THREE.MeshStandardMaterial({color:0xf0eee5,roughness:.55});
    const tower=new THREE.Mesh(new THREE.CylinderGeometry(1.5,3,80,16),white);tower.rotation.x=Math.PI/2;tower.position.z=40;
    const foundation=new THREE.Mesh(new THREE.CylinderGeometry(5,5,1,16),metal);foundation.rotation.x=Math.PI/2;foundation.position.z=.5;
    const nacelle=box(4,9,4,white);nacelle.position.set(0,0,80);
    const rotor=new THREE.Group();rotor.position.set(0,-5.5,80);rotor.name='rotor';
    const hub=new THREE.Mesh(new THREE.SphereGeometry(2.1,12,8),white);rotor.add(hub);
    for(let i=0;i<3;i++){
      const blade=new THREE.Group();blade.rotation.y=i*Math.PI*2/3;
      const shape=new THREE.Shape();shape.moveTo(-.5,2);shape.lineTo(-1.7,8);shape.lineTo(-.8,22);shape.lineTo(0,33);shape.lineTo(.6,22);shape.lineTo(.9,7);shape.closePath();
      const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.35,bevelEnabled:false}),white);mesh.rotation.x=Math.PI/2;blade.add(mesh);rotor.add(blade);
    }
    group.add(foundation,tower,nacelle,rotor);group.userData={kind:item.kind,turbineCount:1,illustrative:true};
  }
  return group;
}

export function disposeModel(root: THREE.Object3D) {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(o=>{if(o instanceof THREE.Mesh || o instanceof THREE.LineSegments){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)o.dispose();}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}

export class RenewableLayer implements CustomLayerInterface {
  id='renewable-proposals-3d';type='custom' as const;renderingMode='3d' as const;
  private map!: GeographicMap;private renderer!:THREE.WebGLRenderer;
  private camera=new THREE.Camera();private entries:Array<{item:Intervention;scene:THREE.Scene;model:THREE.Group;matrix:THREE.Matrix4}>=[];
  private visible=true;
  onAdd(map:GeographicMap,gl:WebGL2RenderingContext){this.map=map;this.renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl});this.renderer.autoClear=false;}
  setItems(items:Intervention[],visible:boolean){
    this.entries.forEach(e=>disposeModel(e.model));this.visible=visible;
    this.entries=items.filter(i=>i.kind==='solar_array'||i.kind==='wind_turbine').map(item=>{
      const scene=new THREE.Scene();const model=buildRenewableModel(item);scene.add(model,new THREE.AmbientLight(0xffffff,2));const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(-100,-100,200);scene.add(sun);
      return {item,scene,model,matrix:new THREE.Matrix4()};
    });this.map?.triggerRepaint();
  }
  render(_gl:WebGL2RenderingContext,options:CustomRenderMethodInput){
    if(!this.visible)return;
    const projection=new THREE.Matrix4().fromArray(options.defaultProjectionData.mainMatrix);
    this.renderer.resetState();
    for(const e of this.entries){
      const altitude=this.map.getTerrain()?this.map.queryTerrainElevation([e.item.lon,e.item.lat])??0:0;
      const origin=MercatorCoordinate.fromLngLat([e.item.lon,e.item.lat],altitude);const scale=origin.meterInMercatorCoordinateUnits();
      const transform=new THREE.Matrix4().makeTranslation(origin.x,origin.y,origin.z).scale(new THREE.Vector3(scale,-scale,scale));
      e.matrix.copy(projection).multiply(transform);this.camera.projectionMatrix.copy(e.matrix);
      this.renderer.render(e.scene,this.camera);
    }
    this.renderer.resetState();
  }
  pick(point:PointLike):string|null {
    if(!this.visible)return null;const p=Array.isArray(point)?{x:point[0],y:point[1]}:point;
    const x=p.x/this.map.getCanvas().clientWidth*2-1,y=1-p.y/this.map.getCanvas().clientHeight*2;
    let picked:string|null=null, nearest=Infinity;
    for(const e of this.entries){
      const inverse=e.matrix.clone().invert();const near=new THREE.Vector3(x,y,-1).applyMatrix4(inverse),far=new THREE.Vector3(x,y,1).applyMatrix4(inverse);
      const ray=new THREE.Raycaster(near,far.sub(near).normalize());
      for(const hit of ray.intersectObject(e.model,true)){const depth=hit.point.clone().applyMatrix4(e.matrix).z;if(depth>=-1&&depth<=1&&depth<nearest){nearest=depth;picked=e.item.id;}}
    }return picked;
  }
  onRemove(){this.entries.forEach(e=>disposeModel(e.model));this.entries=[];this.renderer?.dispose();}
}

