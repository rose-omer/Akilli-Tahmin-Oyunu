import { z } from "zod";
import raw from "@/data/question-tree.json";
import type { Step } from "@/lib/types";

const Id = z.string().regex(/^[a-z0-9_]{1,64}$/);

const QuestionNodeSchema = z
  .object({ id: Id, text: z.string().min(1), yes: Id.nullable(), no: Id.nullable() })
  .strict();
const GuessNodeSchema = z.object({ id: Id, guess: z.string().min(1).max(60) }).strict();

const TreeFileSchema = z
  .object({
    version: z.literal(1),
    root: Id,
    nodes: z.array(z.union([QuestionNodeSchema, GuessNodeSchema])),
  })
  .strict();

export type TreeQuestion = z.infer<typeof QuestionNodeSchema>;
export type TreeGuess = z.infer<typeof GuessNodeSchema>;
export type TreeNode = TreeQuestion | TreeGuess;
export type TreeFile = z.infer<typeof TreeFileSchema>;

export type Tree = {
  root: string;
  nodes: Map<string, TreeNode>;
  /** Aynı metinli sorular tek kimlikte birleşir (motor aynı soruyu iki kez sormasın). */
  canonical: Map<string, string>;
  /** Motorun soru havuzu: tekil metinli ağaç soruları. */
  questions: { id: string; text: string }[];
};

export const isGuess = (node: TreeNode): node is TreeGuess => "guess" in node;

/** Düz JSON listesinden ağacı kurar; tekrarlı kimlik ya da kopuk bağlantıda hata atar. */
export function loadTree(data: unknown = raw): Tree {
  const file = TreeFileSchema.parse(data);
  const nodes = new Map<string, TreeNode>();
  for (const node of file.nodes) {
    if (nodes.has(node.id)) throw new Error(`Tekrarlı düğüm kimliği: ${node.id}`);
    nodes.set(node.id, node);
  }
  if (!nodes.has(file.root)) throw new Error(`Kök düğüm yok: ${file.root}`);
  for (const node of nodes.values()) {
    if (isGuess(node)) continue;
    for (const next of [node.yes, node.no]) {
      if (next && !nodes.has(next)) throw new Error(`Kopuk bağlantı: ${node.id} → ${next}`);
    }
  }

  const canonical = new Map<string, string>();
  const byText = new Map<string, string>();
  const questions: { id: string; text: string }[] = [];
  for (const node of nodes.values()) {
    if (isGuess(node)) continue;
    const key = node.text.toLocaleLowerCase("tr-TR");
    const first = byText.get(key);
    if (first) {
      canonical.set(node.id, first);
    } else {
      byText.set(key, node.id);
      canonical.set(node.id, node.id);
      questions.push({ id: node.id, text: node.text });
    }
  }
  return { root: file.root, nodes, canonical, questions };
}

export type TreeWalk =
  /** Ağaç bir sonraki soruyu biliyor. */
  | { status: "question"; node: TreeQuestion; used: number }
  /** Ağaç bir yaprağa ulaştı. */
  | { status: "guess"; node: TreeGuess; used: number }
  /** Ağaç bitti (boş dal ya da "bilmiyorum"); kalan adımlar motorundur. */
  | { status: "end"; used: number }
  /** Adımlar ağaç yoluna uymuyor. */
  | { status: "invalid" };

/** Adımları kökten yürür. `used`: ağaçta tüketilen adım sayısı. */
export function walkTree(tree: Tree, steps: Step[]): TreeWalk {
  let current: TreeNode | undefined = tree.nodes.get(tree.root);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!current) return { status: "end", used: i };
    if (isGuess(current) || current.id !== step.q) return { status: "invalid" };
    if (step.a === "bilmiyorum") return { status: "end", used: i + 1 };
    const next: string | null = step.a === "evet" ? current.yes : current.no;
    current = next ? tree.nodes.get(next) : undefined;
  }
  if (!current) return { status: "end", used: steps.length };
  return isGuess(current)
    ? { status: "guess", node: current, used: steps.length }
    : { status: "question", node: current, used: steps.length };
}

/** Her yaprak için kökten gelen yol: hangi soruya hangi cevap. Motorun ön bilgisidir. */
export function guessPaths(tree: Tree): { name: string; path: Step[] }[] {
  const out: { name: string; path: Step[] }[] = [];
  const visit = (id: string | null, path: Step[], seen: Set<string>) => {
    if (!id || seen.has(id)) return;
    const node = tree.nodes.get(id);
    if (!node) return;
    if (isGuess(node)) {
      out.push({ name: node.guess, path });
      return;
    }
    const nextSeen = new Set(seen).add(id);
    visit(node.yes, [...path, { q: node.id, a: "evet" }], nextSeen);
    visit(node.no, [...path, { q: node.id, a: "hayır" }], nextSeen);
  };
  visit(tree.root, [], new Set());
  return out;
}

let cached: Tree | null = null;
export function getTree(): Tree {
  cached ??= loadTree();
  return cached;
}
