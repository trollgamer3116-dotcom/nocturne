// The expensive procedural image is sampled at 30 Hz; the display blends at
// its own frame cadence. Camera changes use a fresh image without blending.
export class SkyTimeline{
 constructor(){this.period=1/30;this.epoch=null;this.base=0;this.index=0;this.ready=false;this.rate=0;}
 update(local,skyTime,rate,reset=false){const draws=[];if(reset||this.epoch===null||local<this.epoch||local-this.epoch>this.period*2+1e-7||Math.abs(rate-this.rate)>1e-6){this.epoch=local;this.base=skyTime;this.index=0;this.ready=false;this.rate=rate;draws.push({index:0,time:skyTime});return {draws,index:0,next:0,blend:0};}
  if(!this.ready){draws.push({index:1-this.index,time:this.base+rate*this.period});this.ready=true;}
  if(local-this.epoch>=this.period-1e-7){this.epoch+=this.period;this.base+=rate*this.period;this.index=1-this.index;draws.push({index:1-this.index,time:this.base+rate*this.period});}
  return {draws,index:this.index,next:1-this.index,blend:Math.max(0,Math.min(1,(local-this.epoch)/this.period))};
 }
}
