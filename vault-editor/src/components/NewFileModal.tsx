import { useState, type FC, type KeyboardEvent } from 'react';
import { FOLDERS, type Folder } from '../lib/api';

interface Props {
  onClose: () => void;
  onCreate: (path: string, content: string) => Promise<void>;
}

function buildTemplate(folder: string, title: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `---
title: ${title}
format: mermaid
tags: []
created: ${today}
updated: ${today}
---

# ${title}

> Description goes here.

`;
}

const NewFileModal: FC<Props> = ({ onClose, onCreate }) => {
  const [folder, setFolder] = useState<Folder>('Architecture');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('File name is required'); return; }
    const slug = name.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').toLowerCase();
    if (!slug) { setError('Invalid file name'); return; }
    setLoading(true);
    setError('');
    try {
      await onCreate(`${folder}/${slug}.md`, buildTemplate(folder, name.trim()));
      onClose();
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New File</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Folder</label>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value as Folder)}
              className="form-select"
            >
              {FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>File name</label>
            <input
              type="text"
              placeholder="my-document"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onKey}
              className="form-input"
              autoFocus
            />
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewFileModal;
