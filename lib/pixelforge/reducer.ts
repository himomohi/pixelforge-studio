import { PixelProject, ProjectAction, Layer, Frame, Cel } from './types';
import { blankPixels, celFor, ensureCel, resizePixels } from './project';
import { MAX_CANVAS_DIMENSION, MAX_PROJECT_PIXEL_CELLS } from './presets';
const clone=(p:PixelProject):PixelProject=>({...p,layers:p.layers.map(x=>({...x,frameIds:[...x.frameIds]})),frames:p.frames.map(x=>({...x})),cels:Object.fromEntries(Object.entries(p.cels).map(([k,v])=>[k,{...v,pixels:[...v.pixels]}])) as PixelProject['cels']});
const uid=(s:string)=>`${s}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const fits=(p:PixelProject,cels:number,width=p.width,height=p.height)=>cels*width*height<=MAX_PROJECT_PIXEL_CELLS;
export function projectReducer(state:PixelProject,action:ProjectAction):PixelProject { const p=clone(state); const layer=p.layers.find(x=>x.id===('id' in action?action.id:'')); const frame=p.frames.find(x=>x.id===('id' in action?action.id:''));
 switch(action.type){
 case 'project/replace':return clone(action.project);
 case 'project/rename':p.name=action.name.trim()||p.name;return p;
 case 'layer/add':{if(!fits(p,(p.layers.length+1)*p.frames.length))return p;const l:Layer={id:uid('layer'),name:action.name||`Layer ${p.layers.length+1}`,visible:true,locked:false,opacity:1,frameIds:[]}; for(const f of p.frames){const c:Cel={id:uid('cel'),layerId:l.id,frameId:f.id,pixels:blankPixels(p.width,p.height),duration:f.duration};p.cels[c.id]=c;l.frameIds.push(c.id)}p.layers.push(l);p.activeLayerId=l.id;return p}
 case 'layer/duplicate':{if(!layer||!fits(p,(p.layers.length+1)*p.frames.length)) return p;const l:Layer={...layer,id:uid('layer'),name:`${layer.name} copy`,frameIds:[]};for(const f of p.frames){const src=celFor(p,layer.id,f.id)!;const c={...src,id:uid('cel'),layerId:l.id,pixels:[...src.pixels]};p.cels[c.id]=c;l.frameIds.push(c.id)}p.layers.splice(p.layers.indexOf(layer)+1,0,l);p.activeLayerId=l.id;return p}
 case 'layer/delete':if(p.layers.length>1&&layer){const removedIndex=p.layers.indexOf(layer);for(const id of layer.frameIds)delete p.cels[id];p.layers=p.layers.filter(x=>x!==layer);p.activeLayerId=p.layers[Math.max(0,Math.min(removedIndex-1,p.layers.length-1))].id}return p;
 case 'layer/reorder':if(layer){p.layers.splice(p.layers.indexOf(layer),1);p.layers.splice(Math.max(0,Math.min(action.to,p.layers.length)),0,layer)}return p;
 case 'layer/rename':if(layer)layer.name=action.name;return p;
 case 'layer/visibility':if(layer)layer.visible=action.visible??!layer.visible;return p;
 case 'layer/lock':if(layer)layer.locked=action.locked??!layer.locked;return p;
 case 'layer/opacity':if(layer)layer.opacity=Math.max(0,Math.min(1,action.opacity));return p;
 case 'frame/add':{if(!fits(p,p.layers.length*(p.frames.length+1)))return p;const f:Frame={id:uid('frame'),index:p.frames.length,duration:Math.max(1,action.duration??100)};p.frames.push(f);for(const l of p.layers){const c:Cel={id:uid('cel'),layerId:l.id,frameId:f.id,pixels:blankPixels(p.width,p.height),duration:f.duration};p.cels[c.id]=c;l.frameIds.push(c.id)}p.activeFrameId=f.id;return p}
 case 'frame/duplicate':if(frame&&fits(p,p.layers.length*(p.frames.length+1))){const f={...frame,id:uid('frame')};p.frames.splice(p.frames.indexOf(frame)+1,0,f);for(const l of p.layers){const src=celFor(p,l.id,frame.id)!;const c={...src,id:uid('cel'),frameId:f.id,pixels:[...src.pixels]};p.cels[c.id]=c;l.frameIds.push(c.id)}p.frames.forEach((x,i)=>x.index=i);p.activeFrameId=f.id}return p;
 case 'frame/delete':if(p.frames.length>1&&frame){const removedIndex=p.frames.indexOf(frame);for(const l of p.layers){const c=celFor(p,l.id,frame.id);if(c){delete p.cels[c.id];l.frameIds=l.frameIds.filter(id=>id!==c.id)}}p.frames=p.frames.filter(x=>x!==frame);p.frames.forEach((x,i)=>x.index=i);p.activeFrameId=p.frames[Math.max(0,Math.min(removedIndex-1,p.frames.length-1))].id}return p;
 case 'frame/reorder':if(frame){p.frames.splice(p.frames.indexOf(frame),1);p.frames.splice(Math.max(0,Math.min(action.to,p.frames.length)),0,frame);p.frames.forEach((x,i)=>x.index=i)}return p;
 case 'frame/duration':if(frame){frame.duration=Math.max(1,action.duration);Object.values(p.cels).filter(c=>c.frameId===frame.id).forEach(c=>c.duration=frame.duration)}return p;
 case 'pixels/patch':{const c=ensureCel(p,action.layerId,action.frameId);const l=p.layers.find(x=>x.id===action.layerId);if(l?.locked)return p;for(const q of action.patches)if(q.x>=0&&q.y>=0&&q.x<p.width&&q.y<p.height)c.pixels[q.y*p.width+q.x]=q.color;return p}
 case 'pixels/clear-rect':{const l=p.layers.find(x=>x.id===action.layerId);if(l?.locked)return p;const c=ensureCel(p,action.layerId,action.frameId);const x0=Math.max(0,action.selection.x),y0=Math.max(0,action.selection.y),x1=Math.min(p.width,x0+action.selection.width),y1=Math.min(p.height,y0+action.selection.height);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)c.pixels[y*p.width+x]='';return p}
 case 'cel/clear':{const l=p.layers.find(x=>x.id===action.layerId);if(l?.locked)return p;ensureCel(p,action.layerId,action.frameId).pixels=blankPixels(p.width,p.height);return p}
 case 'canvas/resize':{if(!Number.isInteger(action.width)||!Number.isInteger(action.height)||action.width<1||action.height<1||action.width>MAX_CANVAS_DIMENSION||action.height>MAX_CANVAS_DIMENSION||!fits(p,Object.keys(p.cels).length,action.width,action.height)) return p;for(const c of Object.values(p.cels))c.pixels=resizePixels(c.pixels,p.width,p.height,action.width,action.height,action.anchor);p.width=action.width;p.height=action.height;return p}
 case 'selection/set':p.selection=action.selection;return p;case 'tool/set':p.tool={...p.tool,...action.settings};return p;case 'onion/set':p.onionSkin={...p.onionSkin,...action.settings};return p;case 'symmetry/set':p.symmetry={...p.symmetry,...action.settings};return p;case 'active/set':if(action.layerId)p.activeLayerId=action.layerId;if(action.frameId)p.activeFrameId=action.frameId;return p;
 }}
export * from './types'; export * from './project'; export * from './algorithms';
