export const fullscreenVertex=`varying vec2 screenUv;void main(){screenUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
export const noiseGLSL=`
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,v=0.;for(int i=0;i<4;i++){v+=a*noise2(p);p=mat2(.8,-.6,.6,.8)*p*2.03+17.1;a*=.5;}return v;}
`;
export const skyFragment=`
precision highp float;varying vec2 screenUv;
uniform mat4 cameraWorld;uniform float aspect;uniform float tanFov;uniform vec3 hole;uniform float holeRadius;uniform float time;uniform float flatDisk;uniform int marchSteps;uniform float stepScale;
uniform sampler2D rayTable;uniform sampler2D rayExits;uniform vec2 tableSize;uniform float maxImpact;uniform float maxAngle;
${noiseGLSL}
const float PI=3.14159265359;const float CRITICAL=2.598076211;
vec3 diskCoordinates(vec3 p){return vec3(p.x,.978*p.y+.208*p.z,-.208*p.y+.978*p.z);}
float textureX(float b){float x=b<CRITICAL?.3*b/CRITICAL:.3+.7*sqrt(max(0.,(b-CRITICAL)/(maxImpact-CRITICAL)));return (x*(tableSize.x-1.)+.5)/tableSize.x;}
vec3 sky(vec3 rd){vec2 uv=vec2(atan(rd.z,rd.x)/6.283185+.5,asin(clamp(rd.y,-1.,1.))/PI+.5);float ribbon=exp(-pow((rd.y+.22*sin(atan(rd.z,rd.x)*2.))/.22,2.));float mist=fbm(uv*vec2(17.,10.));float dawn=exp(-pow((rd.y-.04)/.19,2.));float hz=clamp(rd.y,0.,1.);vec3 c=mix(vec3(.004,.010,.028),vec3(.020,.055,.090),pow(clamp(1.-hz,0.,1.),3.))+vec3(.02,.03,.04)*exp(-abs(rd.y)*12.)+vec3(.055,.063,.077)*ribbon*mist+vec3(.10,.058,.025)*dawn;
 for(int i=0;i<2;i++){float scale=i==0?780.:270.;vec2 grid=uv*vec2(scale,scale*.5),cell=floor(grid),f=fract(grid);float seed=hash21(cell+float(i)*137.);vec2 center=vec2(hash21(cell+.25),hash21(cell+17.));float d=length(f-center);float star=exp(-d*d*(i==0?850.:350.))*step(i==0?.955:.992,seed);vec3 tint=mix(vec3(.55,.72,1.),vec3(1.,.78,.48),hash21(cell+12.));float tw=.75+.25*sin(time*3.+seed*60.);c+=tint*star*tw*(i==0?.42:1.4)*smoothstep(-.02,.12,rd.y+.1);}
 vec3 md=normalize(vec3(-.50,.20,-.84));float mc=dot(rd,md);float lon=atan(rd.z,rd.x);
 vec3 band=normalize(vec3(.35,.85,.4));float bd=dot(rd,band);float mw=exp(-bd*bd*14.)*(.45+.9*fbm(uv*vec2(40.,22.)))*smoothstep(-.05,.2,rd.y);float dust=smoothstep(.45,.75,fbm(uv*vec2(60.,30.)+3.));c+=vec3(.03,.029,.034)*mw*(1.-.7*dust*exp(-bd*bd*40.));
 for(int i=0;i<1;i++){vec2 g=uv*vec2(1600.,800.),ce=floor(g);float sd=hash21(ce+9.);c+=vec3(.8,.85,1.)*step(.993-mw*.02,sd)*exp(-dot(fract(g)-.5,fract(g)-.5)*40.)*.5;}
 float disc=smoothstep(.99990,.99993,mc);vec3 mdx=normalize(cross(md,vec3(0.,1.,0.)));vec2 mp=vec2(dot(rd-md,mdx),dot(rd-md,cross(mdx,md)))*90.;float maria=.75+.25*fbm(mp*3.);c=mix(c,vec3(1.6,1.52,1.38)*maria,disc);
 c+=vec3(.6,.62,.66)*(pow(max(mc,0.),4000.)*.5+pow(max(mc,0.),300.)*.06+pow(max(mc,0.),12.)*.015);
 return c;}
vec4 disk(vec3 pos,vec3 incoming){float r=length(pos.xz),edge=smoothstep(3.,3.16,r)*(1.-smoothstep(8.5,11.5,r));if(edge<.0001)return vec4(0.);float angle=atan(pos.z,pos.x),omega=sqrt(1./(2.*r*r*r)),phase=angle-time*omega*9.;vec2 flow=vec2(cos(phase),sin(phase))*r;
 float cloud=fbm(flow*1.75+vec2(r*.7,0.));float winding=r*22.+phase*4.+cloud*9.;float pixel=max(fwidth(winding),.01);float threads=pow(.5+.5*sin(winding+sin(r*5.+phase*3.)*1.4),4.)*(1.-smoothstep(1.,4.,pixel));float braid=pow(.5+.5*sin(r*11.-phase*5.+cloud*7.),3.);float knots=pow(noise2(flow*3.7+vec2(time*.025,0.)),4.);float gap=smoothstep(.12,.77,cloud);float filament=.17+.38*gap+.40*threads+.20*braid+knots*.85;
 float heat=pow(3.2/r,1.13)*(.82+.18*cloud),inner=exp(-pow((r-3.38)/.32,2.));float Tk=clamp(heat*1.15+inner*.25,0.,1.4);vec3 palette=Tk<.5?mix(vec3(.35,.06,.01),vec3(1.,.42,.12),Tk*2.):Tk<1.?mix(vec3(1.,.42,.12),vec3(1.,.86,.66),(Tk-.5)*2.):mix(vec3(1.,.86,.66),vec3(.78,.86,1.),Tk-1.);filament+=inner*.28;
 vec3 velocity=normalize(vec3(-pos.z,0.,pos.x));float beta=sqrt(1./(2.*(r-1.))),doppler=sqrt(1.-beta*beta)/(1.-beta*dot(velocity,-incoming));float shift=sqrt(1.-1./r)*doppler;
 if(flatDisk>.5)shift=1.;palette=mix(palette,vec3(.83,.88,.95),clamp((shift-1.)*.9,0.,.45));float boost=clamp(pow(shift,4.),.08,6.);palette=mix(palette,vec3(1.,.86,.68),.35);return vec4(palette*heat*filament*boost*4.4,edge*.88);}
void main(){vec2 ndc=screenUv*2.-1.;vec3 rd=normalize(mat3(cameraWorld)*vec3(ndc.x*tanFov*aspect,ndc.y*tanFov,-1.));vec3 origin=cameraWorld[3].xyz,ro=(origin-hole)/holeRadius;
 float forward=dot(ro,rd);vec3 impactVector=ro-rd*forward;float b=length(impactVector);vec3 color=sky(rd);float layerDistance=10000.;
 if(flatDisk>.5){vec3 o=diskCoordinates(ro),d=diskCoordinates(rd);float hit=abs(d.y)>.000001?-o.y/d.y:-1.;float horizonHit=forward<0.&&b<1.?-forward-sqrt(max(0.,1.-b*b)):1e10;if(horizonHit<1e9)color=vec3(.0001);vec4 gas=vec4(0.);if(hit>0.&&hit<horizonHit){gas=disk(o+d*hit,d);color=mix(color,gas.rgb,gas.a);}gl_FragColor=vec4(color,gas.a>0.001?hit*holeRadius:(horizonHit<1e9?horizonHit*holeRadius:10000.));return;}
 float R0=length(ro);
 if(forward<0.&&b<34.||R0<34.){
  // Schwarzschild null geodesic: x'' = -1.5 h^2 x / r^5  (rs=1)
  vec3 p=ro,v=rd;if(R0>34.){float t0=-forward-sqrt(max(0.,34.*34.-b*b));p=ro+rd*t0;}
  vec3 hv=cross(p,v);float h2=dot(hv,hv);vec3 emission=vec3(0.);float remaining=1.;bool captured=false;float py=diskCoordinates(p).y;float minR=1e4;
  for(int i=0;i<400;i++){if(i>=marchSteps)break;float r=length(p);minR=min(minR,r);if(r<1.0){captured=true;break;}if(r>36.&&dot(p,v)>0.)break;
   float dt=clamp(.07*r*stepScale,.012,1.6)/length(v);if(r<4.)dt=min(dt,.06*stepScale);
   vec3 acc=-1.5*h2*p/pow(r,5.);vec3 pn=p+v*dt+.5*acc*dt*dt;vec3 accn=-1.5*h2*pn/pow(length(pn),5.);v=v+.5*(acc+accn)*dt;
   float ny=diskCoordinates(pn).y;if(py*ny<0.){float f=py/(py-ny);vec3 hit=mix(p,pn,f);vec4 g=disk(diskCoordinates(hit),diskCoordinates(normalize(v)));emission+=remaining*g.rgb*g.a;remaining*=1.-g.a;}
   py=ny;p=pn;if(remaining<.01)break;}
  vec3 bg=captured?vec3(0.):sky(normalize(v));
  float ring=exp(-pow((minR-1.5)/.035,2.))*(captured?0.:1.);
  color=bg*remaining+emission+vec3(1.,.82,.6)*ring*.35;
  if(captured||remaining<.999||ring>.01)layerDistance=max(.1,(R0-1.)*holeRadius);
 }else if(forward<0.){float alpha=2./max(b,1.);color=sky(normalize(rd*cos(alpha)-normalize(impactVector)*sin(alpha)));}
 gl_FragColor=vec4(color,layerDistance);
}`;
export const waveFragment=`varying vec2 screenUv;uniform sampler2D state;uniform vec2 texel;uniform float dt;uniform float span;uniform vec4 impulses[4];uniform int inputCount;
void main(){vec2 hv=texture2D(state,screenUv).rg;float lap=texture2D(state,screenUv+vec2(texel.x,0.)).r+texture2D(state,screenUv-vec2(texel.x,0.)).r+texture2D(state,screenUv+vec2(0.,texel.y)).r+texture2D(state,screenUv-vec2(0.,texel.y)).r-4.*hv.x;float dx=span*texel.x;hv.y=(hv.y+5.29*dt*lap/(dx*dx))*exp(-dt*.9);hv.x+=dt*hv.y;
vec2 world=(screenUv-.5)*span;for(int i=0;i<4;i++){if(i>=inputCount)break;vec2 d=world-impulses[i].xy;hv.x+=impulses[i].z*exp(-dot(d,d)/.16);}
vec2 edge=min(screenUv,1.-screenUv);float absorb=smoothstep(0.,.075,min(edge.x,edge.y));hv*=mix(exp(-dt*16.),1.,absorb);gl_FragColor=vec4(clamp(hv.x,-.8,.8),clamp(hv.y,-8.,8.),0.,1.);}`;
export const copyFragment=`varying vec2 screenUv;uniform sampler2D image;uniform sampler2D nextImage;uniform float skyBlend;uniform mat4 skyProjection;uniform vec2 skyRayScale;void main(){vec4 sky=texture2D(image,screenUv);sky.rgb=mix(sky.rgb,texture2D(nextImage,screenUv).rgb,skyBlend);vec2 ndc=screenUv*2.-1.;vec3 viewRay=normalize(vec3(ndc*skyRayScale,-1.));vec4 clip=skyProjection*vec4(viewRay*sky.a,1.);gl_FragDepth=sky.a>9999.?1.:clamp(clip.z/clip.w*.5+.5,0.,1.);gl_FragColor=vec4(sky.rgb,1.);}`;
const waterPhysics=`uniform float time;uniform sampler2D waveState;uniform float waveSpan;uniform vec2 waveTexel;
vec3 swell(vec2 p){vec3 result=vec3(0.);for(int i=0;i<12;i++){float fi=float(i),angle=.25+sin(fi*2.39)*1.1+fi*.31;vec2 d=vec2(cos(angle),sin(angle));float k=.14*pow(1.33,fi),a=.30/pow(1.+fi,1.25),omega=sqrt(9.81*k*tanh(min(k*18.,9.)));float phase=k*dot(d,p)-omega*time;result+=vec3(a*sin(phase),a*k*d*cos(phase));}return result;}
float rippleHeight(vec2 p){vec2 uv=p/waveSpan+.5;float mask=step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);float h=texture2D(waveState,clamp(uv,0.,1.)).r;if(h!=h||abs(h)>1.)h=0.;return h*mask;}
vec3 waves(vec2 p){vec3 s=swell(p);float dx=waveTexel.x*waveSpan;float h=rippleHeight(p);return s+vec3(h,(rippleHeight(p+vec2(dx,0.))-rippleHeight(p-vec2(dx,0.)))/(2.*dx),(rippleHeight(p+vec2(0.,dx))-rippleHeight(p-vec2(0.,dx)))/(2.*dx));}
`;
export const waterVertex=`${waterPhysics}uniform mat4 reflectionMatrix;varying vec3 worldPosition;varying vec4 reflectedUv;
void main(){vec3 p=position;vec3 w=waves(p.xz);p.y+=w.x;for(int i=0;i<3;i++){float fi=float(i),angle=.25+fi*1.37;vec2 d=vec2(cos(angle),sin(angle));float k=.18+fi*.17,a=.36/pow(1.+fi,1.16);float phase=k*dot(d,position.xz)-sqrt(9.81*k*tanh(min(k*18.,9.)))*time;p.xz+=d*a*.52*cos(phase);}vec4 world=modelMatrix*vec4(p,1.);worldPosition=world.xyz;reflectedUv=reflectionMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;}`;
export const waterFragment=`${waterPhysics}uniform sampler2D reflectionMap;uniform sampler2D blackHoleImage;uniform vec2 skyScreenSize;uniform vec3 eye;varying vec3 worldPosition;varying vec4 reflectedUv;${noiseGLSL}
void main(){if(texture2D(blackHoleImage,gl_FragCoord.xy/skyScreenSize).a<9999.)discard;vec3 w=waves(worldPosition.xz);vec2 capillary=vec2(0.);float footprint=max(length(dFdx(worldPosition.xz)),length(dFdy(worldPosition.xz)));for(int i=0;i<8;i++){float fi=float(i),k=3.+fi*2.6,a=.006/pow(1.+fi,.7),angle=.8+fi*2.39;vec2 d=vec2(cos(angle),sin(angle));float omega=sqrt((9.81*k+.000072*k*k*k)*tanh(min(k*18.,9.)));capillary+=a*k*d*cos(k*dot(d,worldPosition.xz)-omega*time)*(1.-smoothstep(.5,2.5,footprint*k));}vec3 n=normalize(vec3(-w.y-capillary.x,1.,-w.z-capillary.y));float micro=noise2(worldPosition.xz*9.+vec2(time*.11,time*.06));vec3 view=normalize(eye-worldPosition);float nv=max(dot(n,view),0.);float fresnel=.020+.98*pow(1.-nv,5.);
vec2 uv=reflectedUv.xy/reflectedUv.w;uv+=n.xz*.014/max(.6,reflectedUv.w*.022);vec3 rdir=reflect(-view,n);vec3 skyRef=mix(vec3(.035,.045,.06),vec3(.006,.009,.016),clamp(rdir.y*2.5,0.,1.));vec3 refTex=texture2D(reflectionMap,clamp(uv,.002,.998)).rgb;if(any(notEqual(refTex,refTex))||any(greaterThan(refTex,vec3(60.))))refTex=vec3(0.);vec3 reflection=max(refTex,skyRef);
float shore=exp(-length(worldPosition.xz-vec2(-3.,-2.))*.085);vec2 p=worldPosition.xz*.70+n.xz*1.3;float caustic=pow(max(0.,1.-abs(sin(p.x+sin(p.y+time*.21))+sin(p.y*.87-time*.17))*.65),10.);float absorb=exp(-min(18.,length(eye-worldPosition)*.08)),bed=noise2(p*1.7+n.xz*2.);vec3 depth=mix(vec3(.010,.022,.032),vec3(.020,.050,.060),shore*.7)*(1.+(bed-.5)*shore*.28)+vec3(.05,.08,.08)*caustic*shore*absorb*.70;depth+=vec3(.016,.045,.047)*pow(max(dot(n,normalize(vec3(-5.,5.,4.))),0.),18.)*shore;
vec3 light=normalize(vec3(5.,12.,9.));float spec=pow(max(dot(reflect(-light,n),view),0.),85.);float glint=pow(max(dot(reflect(normalize(vec3(4.,16.,-55.)-worldPosition)*-1.,n),view),0.),270.);vec3 md=normalize(vec3(-.50,.20,-.84));vec3 rv=reflect(-view,n);float mg=max(dot(rv,md),0.);float spark=smoothstep(.6,.9,noise2(worldPosition.xz*vec2(5.,9.)+n.xz*25.+time*.4));vec3 moonPath=vec3(.86,.87,.9)*(pow(mg,400.)*9.*spark+pow(mg,60.)*.5*(.3+.7*spark)+pow(mg,12.)*.02);float sss=smoothstep(-.1,.45,w.x)*pow(max(dot(view,-md),0.)*.5+.5,3.);depth+=vec3(.012,.026,.03)*sss*.6;vec3 c=mix(depth,reflection,clamp(.06+fresnel*.75,0.,1.))+moonPath+vec3(1.,.86,.65)*spec*.9+vec3(.55,.8,1.)*glint*.16;
float crest=smoothstep(.22,.42,w.x)*smoothstep(.12,.30,length(w.yz));float foam=(smoothstep(.16,.36,length(w.yz))*.07+crest*.07)*(.3+.7*micro)*(1.-smoothstep(.3,1.2,footprint));c+=vec3(.55,.58,.6)*foam;float fade=exp(-length(worldPosition.xz)*.005);c=mix(vec3(.035,.045,.058),c,fade);if(any(notEqual(c,c)))c=vec3(.02,.04,.06);gl_FragColor=vec4(c,1.);}`;
export const bloomFragment=`varying vec2 screenUv;uniform sampler2D image;uniform vec2 direction;uniform float extract;void main(){vec3 total=vec3(0.);float weight=0.;for(int i=-4;i<=4;i++){float f=float(i),w=exp(-f*f/6.);vec3 c=texture2D(image,screenUv+direction*f).rgb;if(extract>.5)c=max(c-vec3(.75),0.);total+=c*w;weight+=w;}gl_FragColor=vec4(total/weight,1.);}`;
export const compositeFragment=`varying vec2 screenUv;uniform sampler2D image;uniform sampler2D glow;uniform vec2 resolution;uniform float grain;
void main(){vec2 px=1./resolution;vec3 center=texture2D(image,screenUv).rgb,nw=texture2D(image,screenUv+vec2(-1.,-1.)*px).rgb,ne=texture2D(image,screenUv+vec2(1.,-1.)*px).rgb,sw=texture2D(image,screenUv+vec2(-1.,1.)*px).rgb,se=texture2D(image,screenUv+px).rgb;vec3 luma=vec3(.299,.587,.114);float lnw=dot(nw,luma),lne=dot(ne,luma),lsw=dot(sw,luma),lse=dot(se,luma),lc=dot(center,luma);vec2 dir=vec2(-((lnw+lne)-(lsw+lse)),(lnw+lsw)-(lne+lse));float reduce=max((lnw+lne+lsw+lse)*.03125,.0078125);dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-8.),vec2(8.))*px;
vec3 aa=.5*(texture2D(image,screenUv+dir*(-1./6.)).rgb+texture2D(image,screenUv+dir*(1./6.)).rgb);vec3 bb=aa*.5+.25*(texture2D(image,screenUv-dir*.5).rgb+texture2D(image,screenUv+dir*.5).rgb);float lb=dot(bb,luma);vec3 c=lb<min(lc,min(min(lnw,lne),min(lsw,lse)))||lb>max(lc,max(max(lnw,lne),max(lsw,lse)))?aa:bb;c=mix(c,center,.28);c+=texture2D(glow,screenUv).rgb*.32;float luminance=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(luminance),c,.86);float vig=smoothstep(1.25,.35,length(screenUv-.5)*1.3);c*=mix(.86,1.,vig);float lum2=dot(c,vec3(.2126,.7152,.0722));c+=mix(vec3(-.004,.0,.012),vec3(.02,.008,-.01),smoothstep(.0,.6,lum2));c=pow(max(c,0.),vec3(1.04));float n=fract(sin(dot(screenUv*resolution+grain*61.,vec2(12.9898,78.233)))*43758.5453)-.5;c+=n*.007*(1.-smoothstep(0.,1.,lum2));gl_FragColor=vec4(max(c,0.),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
