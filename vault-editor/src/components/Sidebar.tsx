import { useState, useMemo, type FC } from 'react';
import { FOLDERS } from '../lib/api';

interface Props {
  files: string[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  onDelete: (path: string) => void;
}

function getFolder(filePath: string): string {
  const parts = filePath.split('/');
  return parts.length > 1 ? parts[0] : 'Other';
}

function getFilename(filePath: string): string {
  return filePath.split('/').pop()?.replace(/\.md$/, '') ?? filePath;
}

const Sidebar: FC<Props> = ({ files, activeFile, onFileSelect, onDelete }) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const filtered = search
      ? files.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
      : files;

    const map = new Map<string, string[]>();
    for (const folder of FOLDERS) {
      map.set(folder, []);
    }
    for (const file of filtered) {
      const folder = getFolder(file);
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(file);
    }
    return map;
  }, [files, search]);

  const toggle = (folder: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(folder) ? next.delete(folder) : next.add(folder);
      return next;
    });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <input
          type="search"
          placeholder="Search files…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <nav className="file-tree">
        {Array.from(grouped.entries()).map(([folder, folderFiles]) => (
          <div key={folder} className="folder-group">
            <button
              className="folder-header"
              onClick={() => toggle(folder)}
              title={folder}
            >
              <span className="folder-chevron">{collapsed.has(folder) ? '›' : '⌄'}</span>
              <span className="folder-name">{folder}</span>
              {folderFiles.length > 0 && (
                <span className="folder-badge">{folderFiles.length}</span>
              )}
            </button>

            {!collapsed.has(folder) && (
              <ul className="file-list">
                {folderFiles.map((file) => (
                  <li key={file} className={`file-item ${activeFile === file ? 'active' : ''}`}>
                    <button
                      className="file-btn"
                      onClick={() => onFileSelect(file)}
                      title={file}
                    >
                      <span className="file-name">{getFilename(file)}</span>
                    </button>
                    <button
                      className="file-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(file);
                      }}
                      title="Delete"
                    >
                      ×
                    </button>
                  </li>
                ))}
                {folderFiles.length === 0 && (
                  <li className="file-empty">Empty</li>
                )}
              </ul>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
