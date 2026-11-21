import { describe, expect, it } from "vitest";
import raw from "@/data/question-tree.json";
import { guessPaths, isGuess, loadTree, walkTree } from "@/lib/tree";

const tree = loadTree();

describe("soru ağacı verisi", () => {
  it("kimlikler tekil", () => {
    const ids = raw.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("kopuk bağlantı yok ve her düğüme kökten ulaşılır", () => {
    const reached = new Set<string>();
    const stack = [tree.root];
    while (stack.length) {
      const id = stack.pop()!;
      if (reached.has(id)) continue;
      reached.add(id);
      const node = tree.nodes.get(id);
      expect(node, id).toBeDefined();
      if (node && !isGuess(node)) for (const n of [node.yes, node.no]) if (n) stack.push(n);
    }
    expect(reached.size).toBe(tree.nodes.size);
  });

  it("soru metinleri yazım kurallarına uyar", () => {
    for (const node of tree.nodes.values()) {
      if (isGuess(node)) continue;
      expect(node.text, node.id).not.toMatch(/\s{2,}/);
      expect(node.text, node.id).not.toMatch(/\s[?,.]/);
      expect(node.text, node.id).not.toMatch(/\*/);
      expect(node.text, node.id).toMatch(/\?$/);
      expect(node.text, node.id).toBe(node.text.trim());
    }
  });

  it("tahmin adları tekil ve boş değil", () => {
    const names = [...tree.nodes.values()].filter(isGuess).map((n) => n.guess);
    expect(names.length).toBeGreaterThan(50);
    expect(new Set(names).size).toBe(names.length);
  });

  it("tekrarlı kimlik ve kopuk bağlantı reddedilir", () => {
    const base = { version: 1, root: "a" };
    expect(() =>
      loadTree({
        ...base,
        nodes: [
          { id: "a", guess: "X" },
          { id: "a", guess: "Y" },
        ],
      }),
    ).toThrow(/Tekrarlı/);
    expect(() =>
      loadTree({ ...base, nodes: [{ id: "a", text: "A mı?", yes: "b", no: null }] }),
    ).toThrow(/Kopuk/);
  });
});

describe("walkTree", () => {
  it("kökten başlar", () => {
    const walk = walkTree(tree, []);
    expect(walk.status).toBe("question");
    if (walk.status === "question") expect(walk.node.id).toBe(tree.root);
  });

  it("yaprak bir tahmindir: 'evet' yolu tahmine ulaşır", () => {
    const aslan = guessPaths(tree).find((p) => p.name === "Aslan")!;
    const walk = walkTree(tree, aslan.path);
    expect(walk.status).toBe("guess");
    if (walk.status === "guess") expect(walk.node.guess).toBe("Aslan");
  });

  it("'bilmiyorum' ağacı bitirir", () => {
    expect(walkTree(tree, [{ q: tree.root, a: "bilmiyorum" }])).toEqual({ status: "end", used: 1 });
  });

  it("ağaç yoluna uymayan adım geçersiz", () => {
    expect(walkTree(tree, [{ q: "kedi_mi", a: "evet" }]).status).toBe("invalid");
  });
});
