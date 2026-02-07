import { evaluate } from 'mathjs';
import { Configuration, Point, Contact } from '../types';
import { createConfiguration } from './configurations';

// Import JSON data statically for browser compatibility
import data3 from '../data/3disks.json';
import data4 from '../data/4disks.json';
import data5 from '../data/5disks.json';
import data6 from '../data/6disks.json';

interface RawGraph {
  discos: number;
  centros: (string | number)[][];
  contactos: number[][];
}

interface RawDataFile {
  version: string;
  indexing: string;
  angles: string;
  radius: string;
  graphs: RawGraph[];
}

/**
 * Evaluate a coordinate value that may be a number or a math expression string.
 * Supports expressions like "sqrt(3)", "1/sind(36)", "2*cosd(60)+1", etc.
 * 
 * sind/cosd are sine/cosine in degrees.
 */
function evalCoord(val: string | number): number {
  if (typeof val === 'number') return val;

  // Replace sind(x) → sin(x deg) and cosd(x) → cos(x deg)
  let expr = val
    .replace(/sind\(([^)]+)\)/g, 'sin($1 deg)')
    .replace(/cosd\(([^)]+)\)/g, 'cos($1 deg)');

  try {
    const result = evaluate(expr);
    return typeof result === 'number' ? result : Number(result);
  } catch (e) {
    throw new Error(`Failed to evaluate expression "${val}": ${e}`);
  }
}

/**
 * Parse a raw graph entry into a Configuration object.
 */
function parseGraph(raw: RawGraph, radius: number): Configuration {
  const positions: Point[] = raw.centros.map((c) => [
    evalCoord(c[0]),
    evalCoord(c[1]),
  ]);

  const contacts: Contact[] = raw.contactos.map((e) => [e[0], e[1]]);

  return createConfiguration(positions, contacts, radius);
}

/**
 * Get all raw data files mapped by disk count.
 */
function getDataFiles(): Map<number, RawDataFile> {
  const map = new Map<number, RawDataFile>();
  map.set(3, data3 as unknown as RawDataFile);
  map.set(4, data4 as unknown as RawDataFile);
  map.set(5, data5 as unknown as RawDataFile);
  map.set(6, data6 as unknown as RawDataFile);
  return map;
}

let _catalogCache: Map<string, Configuration> | null = null;

/**
 * Load all configurations from the catalog.
 * Returns a Map from name (e.g. "D5-7") to Configuration.
 */
export function loadAllConfigurations(): Map<string, Configuration> {
  if (_catalogCache) return _catalogCache;

  const catalog = new Map<string, Configuration>();
  const files = getDataFiles();

  files.forEach((data, diskCount) => {
    const radius = parseFloat(data.radius);
    data.graphs.forEach((raw, index) => {
      const name = `D${diskCount}-${index + 1}`;
      const config = parseGraph(raw, radius);
      catalog.set(name, config);
    });
  });

  _catalogCache = catalog;
  return catalog;
}

/**
 * Load a single configuration by name (e.g. "D5-7").
 */
export function loadConfiguration(name: string): Configuration {
  const catalog = loadAllConfigurations();
  const config = catalog.get(name);
  if (!config) {
    const available = Array.from(catalog.keys()).join(', ');
    throw new Error(`Configuration "${name}" not found. Available: ${available}`);
  }
  return config;
}

/**
 * List all available configuration names.
 */
export function listConfigurationNames(): string[] {
  const catalog = loadAllConfigurations();
  return Array.from(catalog.keys()).sort();
}

/**
 * List configuration names filtered by disk count.
 */
export function listConfigurationsBySize(size: number): string[] {
  return listConfigurationNames().filter((name) =>
    name.startsWith(`D${size}-`)
  );
}

/**
 * Get statistics about the catalog.
 */
export function getCatalogStats(): {
  total: number;
  bySize: Map<number, number>;
} {
  const names = listConfigurationNames();
  const bySize = new Map<number, number>();

  for (const name of names) {
    const match = name.match(/^D(\d+)-/);
    if (match) {
      const size = parseInt(match[1]);
      bySize.set(size, (bySize.get(size) || 0) + 1);
    }
  }

  return { total: names.length, bySize };
}
