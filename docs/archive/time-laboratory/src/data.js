export const combinations = Array.from({length:8},(_,i)=>i.toString(2).padStart(3,'0'));
// An illustrative, deterministic design model, not the calibrated game engine.
export function history(id) {
  if(!combinations.includes(id)) throw new Error('Unknown history');
  const [water,predator,food]=[...id].map(Number); let population=120;
  const snapshots=Array.from({length:31},(_,year)=>{
    const freshwater=year<=8 ? 0.92-year*0.025 : water ? Math.min(.86,.72+(year-8)*.012) : Math.max(.08,.72-(year-8)*.055);
    const vegetation=Math.max(.06,Math.min(.95,freshwater*.96+.06));
    if(year>0) {
      const nutrition=vegetation+((food&&year>8&&year<=11)?.32:0);
      const factor=1+(nutrition-.48)*.65-((predator&&year>8)?0:.025);
      population=population===0?0:Math.round(Math.min(240,population*factor));
      if(population<9) population=0;
    }
    return Object.freeze({year,population,freshwater,vegetation});
  });
  return Object.freeze({id,snapshots:Object.freeze(snapshots),final:snapshots[30]});
}
export const describe=id=>`${id[0]==='1'?'Restore':'Do not restore'} freshwater; ${id[1]==='1'?'remove':'retain'} predators; ${id[2]==='1'?'add':'no'} emergency food`;


