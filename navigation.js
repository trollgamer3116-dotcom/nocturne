// Physical clock radius and the exhibit's camera framing are distinct.
// Map the full clock dial onto a useful, visible camera journey.
export function viewingDistance(radius){return 48+62*Math.log(Math.max(1.012,Math.min(24,radius)))/Math.log(24);}
export function orbitLimits(place){return place==='horizon'?{min:40,max:130,polar:.52*Math.PI}:{min:null,max:60,polar:.59*Math.PI};}
