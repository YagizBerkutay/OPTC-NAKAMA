export type ScanGrid={x:number;y:number;size:number;pitchX:number;pitchY:number;columns:number;rows:number};
export type ScanCandidate={id:string;key:string;error:number;similarity:number};
export type Detection={key:string;row:number;col:number;rect:{x:number;y:number;size:number};candidates:ScanCandidate[];error:number;margin:number;status:'confident'|'review'|'unknown';crop:string};
export type ScanResult={width:number;height:number;grid:ScanGrid;detections:Detection[];isCharacterBox:boolean;coverage:number;totalTemplates:number};
export type Selection={key:string;detection:Detection;id:string;selected:boolean;screen:number;manual?:boolean};
