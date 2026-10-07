import * as T from 'three';
import {traceGeodesic as traceRay,CRITICAL_IMPACT} from './physics.js';
export function createLightPaths(scene,hole){
 const group=new T.Group();group.name='Calculated light paths';group.position.copy(hole);group.scale.setScalar(4.2);group.visible=false;scene.add(group);const time={value:0},lines=[];
 const e1=new T.Vector3(-.03,-.16,.986).normalize(),e2=new T.Vector3().crossVectors(new T.Vector3(0,1,0),e1).normalize();
 function make(impact,color,index){const trajectory=traceRay(impact),points=trajectory.points.filter(p=>p.r<13).map(p=>e1.clone().multiplyScalar(Math.cos(p.phi)*p.r).addScaledVector(e2,Math.sin(p.phi)*p.r));if(points.length<3)return null;
  const curve=new T.CatmullRomCurve3(points),mesh=new T.Mesh(new T.TubeGeometry(curve,280,.008,6,false),new T.MeshBasicMaterial({color,transparent:true,opacity:.72,blending:T.AdditiveBlending,depthWrite:false}));mesh.material.color.multiplyScalar(1.7);mesh.rotation.z=(index-1)*.11;mesh.material.onBeforeCompile=s=>{s.uniforms.flowTime=time;s.vertexShader='varying vec2 pathUv;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\npathUv=uv;');s.fragmentShader='uniform float flowTime;varying vec2 pathUv;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=.42+.58*pow(.5+.5*sin(pathUv.x*22.-flowTime*.6),3.);');};mesh.userData.impact=impact;group.add(mesh);return mesh;
 }
 lines.push(make(CRITICAL_IMPACT*.98,0xe49967,0),make(CRITICAL_IMPACT*1.025,0xf2d1a2,1),make(4.2,0x94cad8,2));let impact=4.2;
 return {group,setImpact(value){value=Math.max(1.8,Math.min(7,value));if(Math.abs(value-impact)<.002)return;impact=value;const old=lines[2];if(old){group.remove(old);old.geometry.dispose();old.material.dispose()}lines[2]=make(impact,impact<CRITICAL_IMPACT?0xe89a6a:0x91cddd,2);},setVisible(v){group.visible=v},update(t,radius){time.value=t;group.scale.setScalar(radius)},reset(){this.setImpact(4.2);group.visible=false},dispose(){for(const mesh of lines)if(mesh){mesh.geometry.dispose();mesh.material.dispose()}scene.remove(group)}};
}
