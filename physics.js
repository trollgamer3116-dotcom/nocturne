export const G=6.6743e-11,C=299792458,SOLAR_MASS=1.98847e30;
export const CRITICAL_IMPACT=3*Math.sqrt(3)/2,PHOTON_SPHERE=1.5,ISCO=3;
export const MIN_RADIUS=1.012,MAX_RADIUS=24,GARDEN_RADIUS=50;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
export function horizonRadius(solarMass){return 2*G*solarMass*SOLAR_MASS/(C*C)}
export function clockFactor(radius){if(!Number.isFinite(radius)||radius<=1)throw new RangeError('A static clock must remain outside the horizon');return Math.sqrt(1-1/radius)}
export function relativeRate(emitter,observer){return clockFactor(emitter)/clockFactor(observer)}
export function radiusFromSlider(value){const u=clamp(value,0,100)/100;return 1+Math.exp(Math.log(MIN_RADIUS-1)+u*Math.log((MAX_RADIUS-1)/(MIN_RADIUS-1)))}
export function sliderFromRadius(radius){return 100*Math.log((clamp(radius,MIN_RADIUS,MAX_RADIUS)-1)/(MIN_RADIUS-1))/Math.log((MAX_RADIUS-1)/(MIN_RADIUS-1))}
export function radialLightDelay(emitter,observer,solarMass){const lo=Math.min(emitter,observer),hi=Math.max(emitter,observer);clockFactor(lo);return horizonRadius(solarMass)/C*((hi-lo)+Math.log((hi-1)/(lo-1)))}
export function receivedInterval(emitter,observer){return 1/relativeRate(emitter,observer)}
export function waveOmega(k,depth=18){return Math.sqrt(9.81*k*Math.tanh(k*depth))}
export class ClockSystem{
 constructor(){this.radius=4;this.mass=4300000;this.local=0;this.coordinate=0;this.garden=0;this.paused=false;this.beacons=[];this.nextId=1;this.comparison=null;}
 step(dt){dt=clamp(dt,0,.05);if(this.paused)return;const coordinateDt=dt/clockFactor(this.radius),gardenDt=coordinateDt*clockFactor(GARDEN_RADIUS);this.local+=dt;this.coordinate+=coordinateDt;this.garden+=gardenDt;if(this.comparison&&!this.comparison.done){const used=Math.min(dt,this.comparison.duration-this.comparison.local);this.comparison.local+=used;this.comparison.garden+=gardenDt*(dt?used/dt:0);if(this.comparison.local>=this.comparison.duration-1e-9){this.comparison.local=this.comparison.duration;this.comparison.done=true;}}}
 compare(duration=10){this.comparison={duration:clamp(duration,1,60),local:0,garden:0,done:false};this.paused=false;return this.comparison;}
 setRadius(radius){this.radius=clamp(radius,MIN_RADIUS,MAX_RADIUS)}
 addBeacon(){if(this.beacons.length>=3)return null;const radius=[2.5,6,16][this.beacons.length],beacon={id:this.nextId++,radius};this.beacons.push(beacon);return beacon}
 pulse(beacon){const phase=(this.coordinate-radialLightDelay(beacon.radius,this.radius,this.mass))*clockFactor(beacon.radius);return ((phase%1)+1)%1}
 reset(){this.radius=4;this.mass=4300000;this.local=this.coordinate=this.garden=0;this.paused=false;this.beacons.length=0;this.nextId=1;this.comparison=null;}
}
// Fixed-step damped height-field model. The GPU uses the same constants.
export const WATER_SIZE=256,WATER_SPAN=48,WAVE_SPEED=2.3,WAVE_STEP=1/60;
export function waveCell(height,velocity,neighborSum,dt=WAVE_STEP,dx=WATER_SPAN/WATER_SIZE){const nextVelocity=(velocity+WAVE_SPEED**2*dt*(neighborSum-4*height)/(dx*dx))*Math.exp(-dt*.9);return [height+dt*nextVelocity,nextVelocity];}
export function waterImpulse(distance,amplitude=.14){return amplitude*Math.exp(-distance*distance/.16);}
// Schwarzschild null geodesic: q = r_s/r, q'' + q = 3q²/2.
// Incoming light starts at infinity with q(0)=0 and q'(0)=1/b.
export function rayStep(q,v,h){const f=x=>1.5*x*x-x,a=v,b=f(q),c=v+b*h*.5,d=f(q+a*h*.5),e=v+d*h*.5,fv=f(q+c*h*.5),g=v+fv*h,j=f(q+e*h);return [q+h*(a+2*c+2*e+g)/6,v+h*(b+2*d+2*fv+j)/6]}
export function traceRay(impact,{step=.002,maxAngle=Math.PI*6}={}){
 if(!(impact>0))return {captured:true,escaped:false,exit:0,minRadius:1,points:[]};
 let q=0,v=1/impact,phi=0,minRadius=Infinity;const points=[];
 while(phi<maxAngle){const previous=q;[q,v]=rayStep(q,v,step);phi+=step;if(q>0){minRadius=Math.min(minRadius,1/q);if(phi>.015)points.push({phi,q,r:1/q})}if(q>=1)return {captured:true,escaped:false,exit:phi,minRadius:1,points};if(q<=0&&previous>0)return {captured:false,escaped:true,exit:phi-step*q/(q-previous),minRadius,points};}
 return {captured:false,escaped:false,exit:maxAngle,minRadius,points};
}
export function impactToTexture(b,maxImpact=32){return b<CRITICAL_IMPACT?.3*b/CRITICAL_IMPACT:.3+.7*Math.sqrt((b-CRITICAL_IMPACT)/(maxImpact-CRITICAL_IMPACT))}
export function textureToImpact(u,maxImpact=32){return u<.3?CRITICAL_IMPACT*u/.3:CRITICAL_IMPACT+(maxImpact-CRITICAL_IMPACT)*((u-.3)/.7)**2}
export function buildRayTable({width=640,height=512,maxImpact=32,maxAngle=Math.PI*4}={}){
 const data=new Float32Array(width*height),exits=new Float32Array(width*4),delta=maxAngle/(height-1),substeps=6,h=delta/substeps;
 for(let x=0;x<width;x++){const b=textureToImpact(x/(width-1),maxImpact);let q=0,v=b>0?1/b:0,active=b>0,escape=0,capture=b===0?1:0,minRadius=Infinity;
  for(let y=0;y<height;y++){if(y>0&&active){for(let s=0;s<substeps;s++){const old=q;[q,v]=rayStep(q,v,h);if(q>=1){q=1;capture=1;active=false;break}if(q<0&&old>0){escape=(y-1)*delta+s*h+h*old/(old-q);q=0;active=false;break}if(q>0)minRadius=Math.min(minRadius,1/q);}}
   data[y*width+x]=Math.max(0,Math.min(1,q));
  }
  exits.set([escape,capture,Number.isFinite(minRadius)?Math.min(minRadius,10000):10000,active?1:0],x*4);
 }
 return {data,exits,width,height,maxImpact,maxAngle};
}
// Same integrator as the ray-marched sky shader (rs=1): velocity-Verlet on x''=-1.5 h^2 x/r^5, adaptive step.
export function traceGeodesic(impact,{start=40,maxSteps=4000,stepScale=.5}={}){
 let px=-Math.sqrt(Math.max(0,start*start-impact*impact)),py=impact,vx=1,vy=0;const h2=impact*impact,points=[];let captured=false,minRadius=Infinity,phi=0,lastA=Math.atan2(py,px);
 for(let i=0;i<maxSteps;i++){const r=Math.hypot(px,py),a=Math.atan2(py,px);let d=a-lastA;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;phi-=d;lastA=a;minRadius=Math.min(minRadius,r);if(r<start)points.push({r,phi,q:1/r});if(r<1){captured=true;break}if(r>start+1&&px*vx+py*vy>0)break;
  let dt=Math.min(Math.max(.07*r*stepScale,.006),1.6);if(r<4)dt=Math.min(dt,.06*stepScale);dt/=Math.hypot(vx,vy);
  const k=-1.5*h2/r**5,ax=k*px,ay=k*py,nx=px+vx*dt+.5*ax*dt*dt,ny=py+vy*dt+.5*ay*dt*dt,kn=-1.5*h2/Math.hypot(nx,ny)**5;
  vx+=.5*(ax+kn*nx)*dt;vy+=.5*(ay+kn*ny)*dt;px=nx;py=ny;}
 return {points,captured,escaped:!captured,exit:phi,minRadius:captured?1:minRadius};
}
