import { Anchor, Cel, Frame, Layer, PixelProject, Pixels } from './types';
import { MAX_CANVAS_DIMENSION, MAX_PROJECT_PIXEL_CELLS } from './presets';
import { DEFAULT_REFERENCE_IMAGE_STATE, validateReferenceImageState } from './reference-image';
let seq = 0; const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`;
export const blankPixels = (w: number, h: number): Pixels => Array(w*h).fill('');
export const pixelIndex = (x:number,y:number,w:number) => y*w+x;
export function createProject(width=32,height=32,name='Untitled'): PixelProject { if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>MAX_CANVAS_DIMENSION||height>MAX_CANVAS_DIMENSION) throw new Error(`Canvas dimensions must be whole numbers between 1 and ${MAX_CANVAS_DIMENSION} pixels`); if(width*height>MAX_PROJECT_PIXEL_CELLS) throw new Error(`A single canvas may contain at most ${MAX_PROJECT_PIXEL_CELLS.toLocaleString()} pixels`); const l:Layer={id:id('layer'),name:'Layer 1',visible:true,locked:false,opacity:1,frameIds:[]}; const f:Frame={id:id('frame'),index:0,duration:100}; const c:Cel={id:id('cel'),frameId:f.id,layerId:l.id,pixels:blankPixels(width,height),duration:100}; l.frameIds=[c.id]; return {version:1,id:id('project'),name,width,height,layers:[l],frames:[f],cels:{[c.id]:c},palettes:[],activeLayerId:l.id,activeFrameId:f.id,tool:{tool:'pencil',color:'#000000',size:1,fill:false},onionSkin:{enabled:false,previous:1,next:1,opacity:.25},symmetry:{enabled:false,x:false,y:false,centerX:width/2,centerY:height/2},selection:null,referenceImage:{...DEFAULT_REFERENCE_IMAGE_STATE,overlayRect:{...DEFAULT_REFERENCE_IMAGE_STATE.overlayRect}}}; }
export const celFor = (p:PixelProject,layerId:string,frameId:string) => Object.values(p.cels).find(c=>c.layerId===layerId&&c.frameId===frameId);
export function ensureCel(p:PixelProject,layerId:string,frameId:string): Cel { const c=celFor(p,layerId,frameId); if(!c) throw new Error('Cel not found'); return c; }
export function resizePixels(src:Pixels,oldW:number,oldH:number,w:number,h:number,anchor:Anchor='top-left'):Pixels { const out=blankPixels(w,h); const dx=anchor.includes('right')?w-oldW:anchor.includes('left')?0:Math.floor((w-oldW)/2); const dy=anchor.includes('bottom')?h-oldH:anchor.includes('top')?0:Math.floor((h-oldH)/2); for(let y=0;y<oldH;y++)for(let x=0;x<oldW;x++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<w&&ny<h)out[pixelIndex(nx,ny,w)]=src[pixelIndex(x,y,oldW)];} return out; }
export function validateProject(p:unknown): p is PixelProject {
  const x=p as PixelProject;
  if(!x||x.version!==1||typeof x.id!=='string'||typeof x.name!=='string')return false;
  if(!Number.isInteger(x.width)||x.width<1||x.width>MAX_CANVAS_DIMENSION||!Number.isInteger(x.height)||x.height<1||x.height>MAX_CANVAS_DIMENSION)return false;
  if(!Array.isArray(x.layers)||x.layers.length<1||!Array.isArray(x.frames)||x.frames.length<1||!x.cels||typeof x.cels!=='object'||Array.isArray(x.cels)||!Array.isArray(x.palettes))return false;
  const layerIds=new Set(x.layers.map(layer=>layer.id));
  const frameIds=new Set(x.frames.map(frame=>frame.id));
  if(layerIds.size!==x.layers.length||frameIds.size!==x.frames.length||!layerIds.has(x.activeLayerId)||!frameIds.has(x.activeFrameId))return false;
  if(x.frames.some((frame,index)=>typeof frame.id!=='string'||frame.index!==index||!Number.isFinite(frame.duration)||frame.duration<1))return false;
  const cels=Object.entries(x.cels);
  if(cels.length!==x.layers.length*x.frames.length)return false;
  if(cels.length*x.width*x.height>MAX_PROJECT_PIXEL_CELLS)return false;
  const pairs=new Set<string>();
  const color=/^$|^#[0-9a-f]{3,4}$|^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
  for(const [key,cel] of cels){
    if(!cel||key!==cel.id||typeof cel.id!=='string'||!layerIds.has(cel.layerId)||!frameIds.has(cel.frameId)||!Number.isFinite(cel.duration)||cel.duration<1||!Array.isArray(cel.pixels)||cel.pixels.length!==x.width*x.height)return false;
    if(cel.pixels.some(pixel=>typeof pixel!=='string'||!color.test(pixel)))return false;
    const pair=cel.layerId+'::'+cel.frameId;
    if(pairs.has(pair))return false;
    pairs.add(pair);
  }
  for(const layer of x.layers){
    if(typeof layer.id!=='string'||typeof layer.name!=='string'||typeof layer.visible!=='boolean'||typeof layer.locked!=='boolean'||!Number.isFinite(layer.opacity)||layer.opacity<0||layer.opacity>1||!Array.isArray(layer.frameIds)||layer.frameIds.length!==x.frames.length)return false;
    const expected=new Set(cels.filter(([,cel])=>cel.layerId===layer.id).map(([key])=>key));
    const listed=new Set(layer.frameIds);
    if(listed.size!==expected.size||layer.frameIds.some(celId=>typeof celId!=='string'||!expected.has(celId)))return false;
  }
  const tools=new Set(['pencil','eraser','line','rectangle','ellipse','fill','picker','select','hand']);
  if(!x.tool||!tools.has(x.tool.tool)||!color.test(x.tool.color)||!Number.isInteger(x.tool.size)||x.tool.size<1||x.tool.size>8||typeof x.tool.fill!=='boolean')return false;
  if(!x.onionSkin||typeof x.onionSkin.enabled!=='boolean'||!Number.isInteger(x.onionSkin.previous)||x.onionSkin.previous<0||!Number.isInteger(x.onionSkin.next)||x.onionSkin.next<0||!Number.isFinite(x.onionSkin.opacity)||x.onionSkin.opacity<0||x.onionSkin.opacity>1)return false;
  if(!x.symmetry||typeof x.symmetry.enabled!=='boolean'||typeof x.symmetry.x!=='boolean'||typeof x.symmetry.y!=='boolean'||!Number.isFinite(x.symmetry.centerX)||!Number.isFinite(x.symmetry.centerY))return false;
  if(x.selection!==null&&(!x.selection||!Number.isInteger(x.selection.x)||!Number.isInteger(x.selection.y)||!Number.isInteger(x.selection.width)||!Number.isInteger(x.selection.height)||x.selection.x<0||x.selection.y<0||x.selection.width<1||x.selection.height<1||x.selection.x+x.selection.width>x.width||x.selection.y+x.selection.height>x.height))return false;
  if(x.palettes.some(palette=>!palette||typeof palette.id!=='string'||typeof palette.name!=='string'||!Array.isArray(palette.colors)||palette.colors.some(value=>typeof value!=='string'||!color.test(value))))return false;
  if(x.referenceImage!==undefined&&!validateReferenceImageState(x.referenceImage))return false;
  return true;
}
export const serializeProject=(p:PixelProject)=>JSON.stringify(p);
export function deserializeProject(raw:string):PixelProject { const p=JSON.parse(raw); if(!validateProject(p)) throw new Error('Invalid PixelForge project'); return p; }
