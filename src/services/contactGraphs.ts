import { Configuration, GraphValidation, Contact } from '../types';

/**
 * Build an adjacency list from contacts.
 */
function buildAdjacencyList(n: number, contacts: Contact[]): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  for (let i = 0; i < n; i++) {
    adj.set(i, new Set());
  }
  for (const [u, v] of contacts) {
    adj.get(u)?.add(v);
    adj.get(v)?.add(u);
  }
  return adj;
}

/**
 * Check if the graph is connected using BFS.
 */
function isConnected(n: number, contacts: Contact[]): boolean {
  if (n === 0) return true;
  if (n === 1) return true;
  if (contacts.length === 0) return n <= 1;

  const adj = buildAdjacencyList(n, contacts);
  const visited = new Set<number>();
  const queue: number[] = [0];
  visited.add(0);

  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const neighbor of Array.from(adj.get(node) || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited.size === n;
}

/**
 * Compute the degree of each vertex.
 */
function computeVertexDegrees(n: number, contacts: Contact[]): number[] {
  const degrees = Array(n).fill(0);
  for (const [u, v] of contacts) {
    degrees[u]++;
    degrees[v]++;
  }
  return degrees;
}

/**
 * Validate a contact graph for physical realizability.
 * 
 * Checks:
 * 1. All indices in valid range [0, n-1]
 * 2. No self-loops
 * 3. No duplicate edges
 * 4. Graph is connected
 * 5. No vertex has degree > 6 (kissing number in R^2)
 * 6. Edge count matches expected formula (if applicable)
 */
export function checkGraphValidity(config: Configuration): GraphValidation {
  const { n, contacts } = config;
  const allContacts = [...contacts, ...config.latticeContacts];
  const actualEdges = allContacts.length;

  // Check index bounds
  for (const [u, v] of allContacts) {
    if (u < 0 || u >= n || v < 0 || v >= n) {
      return {
        isValid: false,
        expectedEdges: 0,
        actualEdges,
        message: `Invalid index in contact (${u}, ${v}): must be in [0, ${n - 1}]`,
      };
    }
  }

  // Check self-loops
  for (const [u, v] of allContacts) {
    if (u === v) {
      return {
        isValid: false,
        expectedEdges: 0,
        actualEdges,
        message: `Self-loop detected at vertex ${u}`,
      };
    }
  }

  // Check duplicate edges
  const edgeSet = new Set<string>();
  for (const [u, v] of allContacts) {
    const key = u < v ? `${u}-${v}` : `${v}-${u}`;
    if (edgeSet.has(key)) {
      return {
        isValid: false,
        expectedEdges: 0,
        actualEdges,
        message: `Duplicate edge (${u}, ${v})`,
      };
    }
    edgeSet.add(key);
  }

  // Check connectivity
  if (!isConnected(n, allContacts)) {
    return {
      isValid: false,
      expectedEdges: 0,
      actualEdges,
      message: 'Graph is not connected',
    };
  }

  // Check kissing number (max degree 6 in R^2)
  const degrees = computeVertexDegrees(n, allContacts);
  for (let i = 0; i < n; i++) {
    if (degrees[i] > 6) {
      return {
        isValid: false,
        expectedEdges: 0,
        actualEdges,
        message: `Vertex ${i} has degree ${degrees[i]} > 6 (kissing number violation)`,
      };
    }
  }

  // Expected edges formula: 2n + 1 for a rigid packing (informational)
  const expectedEdges = 2 * n + 1;

  return {
    isValid: true,
    expectedEdges,
    actualEdges,
    message:
      actualEdges === expectedEdges
        ? 'Valid graph with expected edge count'
        : `Valid graph (${actualEdges} edges, expected ${expectedEdges} for rigidity)`,
  };
}
