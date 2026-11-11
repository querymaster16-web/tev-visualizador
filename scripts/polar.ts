import { analizar } from '../src/chem/analisis';
const apolar = ['CO2','BF3','CH4','CCl4','PCl5','SF6','XeF2','XeF4','BeCl2','SO3','C2H4','C2H2','C6H6'];
const polar = ['H2O','NH3','SO2','SF4','ClF3','BrF5','CH2Cl2','CHCl3','O3','HCN','H2CO','NO2','XeOF4'];
for (const f of apolar) { const a:any = (analizar(f) as any).analisis; if (a.geometria.dipolo.polar) console.log('DEBERIA SER APOLAR', f, a.geometria.dipolo.magnitud.toFixed(2)); }
for (const f of polar) { const a:any = (analizar(f) as any).analisis; if (!a.geometria.dipolo.polar) console.log('DEBERIA SER POLAR', f, a.geometria.dipolo.magnitud.toFixed(2)); }
console.log('fin');
for (const f of ['OF2','SCl2','H2S','NF3','O3','NO2-','H2Se','PH3','XeF6','CH3Cl','SO2','HCN']) { const a:any = (analizar(f) as any).analisis; console.log(f, a.geometria.dipolo.polar ? 'polar' : 'APOLAR', a.geometria.dipolo.magnitud.toFixed(2)); }
