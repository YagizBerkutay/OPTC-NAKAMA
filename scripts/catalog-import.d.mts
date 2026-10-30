import type {Catalog} from '../src/model';
export function readAssignment(text:string,name:string):Record<string,any>;
export function textOf(value:unknown):string;
export function buildCatalog(input:{units:Record<string,any>;details:Record<string,any>;flags:Record<string,any>;rumble:{units:any[]};previous?:{characters:any[]};revision:{sha:string;date?:string};now?:string}):Catalog;
