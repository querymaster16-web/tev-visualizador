import { analizar } from '../src/chem/analisis';
import { anguloEntre, sub } from '../src/chem/vec';
const ang=(f:string,i:number,c:number,j:number)=>{const r:any=analizar(f);const p=r.analisis.geometria.pos;return anguloEntre(sub(p[i],p[c]),sub(p[j],p[c])).toFixed(1)};
console.log('H2O',ang('H2O',1,0,2),'NH3',ang('NH3',1,0,2),'SO2',ang('SO2',1,0,2),'SF4 ax',ang('SF4',1,0,2),'SF4 eq',ang('SF4',3,0,4),'ClF3',ang('ClF3',1,0,2),'BrF5',ang('BrF5',1,0,3),'O3',ang('O3',1,0,2),'NO2',ang('NO2',1,0,2),'ClO2',ang('ClO2',1,0,2));
const r:any=analizar('[N](F)(F)(F)(F)F'); console.log(r.tipo, r.analisis?.tev.atomos[0].error);
const e:any=analizar('C2H4'); console.log(e.analisis.geometria.longitudes.map((x:number)=>x.toFixed(2)).join(' '));
