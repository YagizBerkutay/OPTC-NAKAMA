import { type AppState } from './model';
import { type ScanGrid, type ScanResult } from './recognition';
import type { Encounter } from './boss-library';
import type { RumbleRules } from './rumble-rules';
import type { AssaultContext } from './assault-rumble';
import type { GPRules } from './grand-party-rules';
import type { PkaEvent } from './pka';
import type { PkaRumbleContext } from './pka-rumble';
import type { CoopObservation, CoopQuestTarget, CoopQuestMenu, CoopQuestRead } from './coop';
import type { KizunaImagePage } from './kizuna-import';
import type { KizunaAutoResult, KizunaTarget } from './kizuna-auto';

export type GuideEntry = { url: string; name: string; kind: string };
export type BossImageRead = {
  name: string;
  hash: string;
  text: string;
  identity?: { title: string; difficulty: number | null; level: number | null };
  warnings: string[];
};
export type BossImageInput = {
  title: string;
  difficulty: number;
  mode?: 'quest' | 'pka';
  levelRange?: number[];
  level: number | null;
  requirement: string;
  noRestrictions: boolean;
  confirmed: boolean;
  pages: { hash: string; text: string; battle: number; trigger: string }[];
};

// Interface Segregation Principle (ISP) - Segregated Bridges
export interface ICoopBridge {
  coopTarget(input: {
    exe: string;
    device: string;
    action: 'list' | 'guide';
    scope: 'main' | 'event';
    target?: CoopQuestTarget;
    enemyType?: string;
  }): Promise<CoopQuestMenu | CoopQuestRead>;
  coopRead(input: {
    exe: string;
    device: string;
    section: 'rules' | 'captainHelp' | 'playHelp' | 'skipHelp';
  }): Promise<CoopObservation>;
  cancelCoop(): Promise<boolean>;
  onCoopProgress(callback: (text: string) => void): () => void;
}

export interface IPkaBridge {
  pkaRumbleRead(input: {
    exe: string;
    device: string;
    refresh?: boolean;
  }): Promise<PkaRumbleContext>;
  cancelPkaRumble(): Promise<boolean>;
  onPkaRumbleProgress(callback: (text: string) => void): () => void;
  pkaEvent(refresh: boolean): Promise<PkaEvent>;
  pkaGuide(input: { exe: string; device: string; level: number }): Promise<Encounter>;
  cancelPka(): Promise<boolean>;
  onPkaProgress(callback: (text: string) => void): () => void;
}

export interface IAssaultBridge {
  assaultRead(input: {
    exe: string;
    device: string;
    refresh?: boolean;
  }): Promise<AssaultContext>;
  cancelAssault(): Promise<boolean>;
  onAssaultProgress(callback: (text: string) => void): () => void;
}

export interface IKizunaBridge {
  kizunaImages(images: { name: string; dataUrl: string }[]): Promise<KizunaImagePage[]>;
  cancelKizunaImages(): Promise<boolean>;
  onKizunaImageProgress(callback: (text: string) => void): () => void;
  kizunaAuto(input: { exe: string; device: string; difficulty: number }): Promise<KizunaAutoResult>;
  kizunaTarget(input: { exe: string; device: string; difficulty: number }): Promise<KizunaTarget | null>;
  cancelKizunaAuto(): Promise<boolean>;
  onKizunaAutoProgress(callback: (text: string) => void): () => void;
}

export interface IBossBridge {
  ambush(boss: Encounter): Promise<Encounter>;
  confirmGuide(
    url: string,
    input: {
      title: string;
      difficulty: number;
      requirement: string;
      noRestrictions: boolean;
      confirmed: boolean;
    }
  ): Promise<Encounter>;
  bossImages(images: { name: string; dataUrl: string }[]): Promise<BossImageRead[]>;
  bossFromImages(input: BossImageInput): Promise<Encounter>;
  bossBehavior(exe: string, device: string): Promise<Encounter>;
  cancelBossBehavior(): Promise<boolean>;
  onBossProgress(callback: (text: string) => void): () => void;
}

export interface IRumbleBridge {
  rumbleRules(exe: string, device: string): Promise<RumbleRules>;
  cancelRumbleRules(): Promise<boolean>;
  onRumbleProgress(callback: (text: string) => void): () => void;
}

export interface IGrandPartyBridge {
  grandPartyRules(input: { exe: string; device: string }): Promise<GPRules>;
  cancelGrandPartyRules(): Promise<boolean>;
  onGrandPartyProgress(callback: (text: string) => void): () => void;
}

export interface IAdbBridge {
  pickAdb(): Promise<string | null>;
  discoverAdb(): Promise<string | null>;
  devices(exe: string): Promise<{ id: string; status: string }[]>;
  connect(exe: string, device: string): Promise<string>;
  screenshot(exe: string, device: string): Promise<string>;
  boxScroll(exe: string, device: string, geometry: { width: number; height: number }): Promise<boolean>;
}

export interface IRecognitionBridge {
  recognize(dataUrl: string, grid?: ScanGrid | null): Promise<ScanResult>;
}

export interface IStateBridge {
  load(): Promise<string | null>;
  save(payload: string): Promise<boolean>;
  dataPath(): Promise<string>;
}

export interface IUtilityBridge {
  guides(): Promise<{ guides: GuideEntry[]; cached: boolean; warning?: string }>;
  guide(url: string, refresh?: boolean): Promise<Encounter & { cached: boolean }>;
  reportDiagnostic?(payload: { kind: string; message: string; details?: unknown }): Promise<boolean>;
  openDiagnostics?(): Promise<boolean>;
  openExternal?(url: string): Promise<boolean>;
}

export type NakamaBridge = ICoopBridge &
  IPkaBridge &
  IAssaultBridge &
  IKizunaBridge &
  IBossBridge &
  IRumbleBridge &
  IGrandPartyBridge &
  IAdbBridge &
  IRecognitionBridge &
  IStateBridge &
  IUtilityBridge;

declare global {
  interface Window {
    nakama?: NakamaBridge;
  }
}

// Storage abstraction (Dependency Inversion Principle)
export interface IStorageProvider {
  load(): Promise<string | null>;
  save(state: AppState): Promise<void>;
}

export class DefaultStorageProvider implements IStorageProvider {
  async load(): Promise<string | null> {
    if (window.nakama) {
      return window.nakama.load();
    }
    return localStorage.getItem('optc-nakama-v1');
  }

  async save(state: AppState): Promise<void> {
    const payload = JSON.stringify(state);
    if (window.nakama) {
      await window.nakama.save(payload);
    } else {
      localStorage.setItem('optc-nakama-v1', payload);
    }
  }
}

let activeStorageProvider: IStorageProvider = new DefaultStorageProvider();

export function setStorageProvider(provider: IStorageProvider) {
  activeStorageProvider = provider;
}

export async function loadState(): Promise<string | null> {
  return activeStorageProvider.load();
}

export async function saveState(state: AppState): Promise<void> {
  return activeStorageProvider.save(state);
}

export function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
