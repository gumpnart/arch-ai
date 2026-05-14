const BASE = '/api';

export const FOLDERS = ['Architecture', 'Flows', 'Sequences', 'Infrastructure', 'Notes'] as const;
export type Folder = (typeof FOLDERS)[number];

export const api = {
  async listFiles(): Promise<string[]> {
    const res = await fetch(`${BASE}/diagrams`);
    if (!res.ok) throw new Error('Failed to list files');
    return res.json() as Promise<string[]>;
  },

  async readFile(filePath: string): Promise<string> {
    const res = await fetch(`${BASE}/diagrams/${filePath}`);
    if (!res.ok) throw new Error(`Failed to read ${filePath}`);
    const data = (await res.json()) as { path: string; content: string };
    return data.content;
  },

  async writeFile(filePath: string, content: string): Promise<void> {
    const res = await fetch(`${BASE}/diagrams/${filePath}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(`Failed to write ${filePath}`);
  },

  async deleteFile(filePath: string): Promise<void> {
    const res = await fetch(`${BASE}/diagrams/${filePath}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete ${filePath}`);
  },

  async gitStatus(): Promise<{ status: string }> {
    const res = await fetch(`${BASE}/git/status`);
    if (!res.ok) throw new Error('Failed to get git status');
    return res.json() as Promise<{ status: string }>;
  },

  async gitCommit(message: string): Promise<void> {
    const res = await fetch(`${BASE}/git/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      throw new Error(err.error || 'Commit failed');
    }
  },

  async gitClone(url: string, branch?: string): Promise<void> {
    const res = await fetch(`${BASE}/git/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, branch }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      throw new Error(err.error || 'Clone failed');
    }
  },

  async renderDiagram(format: string, source: string): Promise<string> {
    const res = await fetch(`${BASE}/diagrams/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, source }),
    });
    if (!res.ok) throw new Error('Render failed');
    const data = (await res.json()) as { svg: string };
    return data.svg;
  },
};
