import { useState, useEffect, type FC } from 'react';
import { api } from '../lib/api';

type Tab = 'status' | 'clone';

interface Props {
  onClose: () => void;
  onCloned: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const GitModal: FC<Props> = ({ onClose, onCloned, onToast }) => {
  const [tab, setTab] = useState<Tab>('status');

  // Status tab state
  const [gitStatus, setGitStatus] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('docs: update vault');
  const [commitLoading, setCommitLoading] = useState(false);

  // Clone tab state
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneBranch, setCloneBranch] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);

  useEffect(() => {
    if (tab === 'status') loadStatus();
  }, [tab]);

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const data = await api.gitStatus();
      setGitStatus(data.status || '(nothing to commit, working tree clean)');
    } catch {
      setGitStatus('Failed to load git status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) { onToast('Commit message is required', 'error'); return; }
    setCommitLoading(true);
    try {
      await api.gitCommit(commitMsg.trim());
      onToast('Committed and pushed', 'success');
      setCommitMsg('docs: update vault');
      loadStatus();
    } catch (e) {
      onToast(`Commit failed: ${String(e)}`, 'error');
    } finally {
      setCommitLoading(false);
    }
  };

  const handleClone = async () => {
    if (!cloneUrl.trim()) { onToast('Repository URL is required', 'error'); return; }
    if (!window.confirm('Clone will replace the current vault content. Continue?')) return;
    setCloneLoading(true);
    try {
      await api.gitClone(cloneUrl.trim(), cloneBranch.trim() || undefined);
      onToast('Repository cloned', 'success');
      onClose();
      onCloned();
    } catch (e) {
      onToast(`Clone failed: ${String(e)}`, 'error');
    } finally {
      setCloneLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Git</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === 'status' ? 'active' : ''}`}
            onClick={() => setTab('status')}
          >
            Status &amp; Commit
          </button>
          <button
            className={`modal-tab ${tab === 'clone' ? 'active' : ''}`}
            onClick={() => setTab('clone')}
          >
            Clone Repository
          </button>
        </div>

        <div className="modal-body">
          {tab === 'status' && (
            <>
              <div className="form-group">
                <label>Working tree</label>
                {statusLoading ? (
                  <div className="status-loading">Loading…</div>
                ) : (
                  <pre className="git-status-pre">{gitStatus}</pre>
                )}
              </div>
              <div className="form-group">
                <label>Commit message</label>
                <input
                  type="text"
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
                  className="form-input"
                  placeholder="docs: update vault"
                />
              </div>
            </>
          )}

          {tab === 'clone' && (
            <>
              <p className="clone-warning">
                ⚠ Cloning will replace the current vault content with the remote repository.
              </p>
              <div className="form-group">
                <label>Repository URL</label>
                <input
                  type="url"
                  placeholder="https://github.com/user/vault.git"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  className="form-input"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Branch <span className="label-optional">(optional)</span></label>
                <input
                  type="text"
                  placeholder="main"
                  value={cloneBranch}
                  onChange={(e) => setCloneBranch(e.target.value)}
                  className="form-input"
                />
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {tab === 'status' && (
            <button className="btn btn-primary" onClick={handleCommit} disabled={commitLoading}>
              {commitLoading ? 'Committing…' : '⎇ Commit & Push'}
            </button>
          )}
          {tab === 'clone' && (
            <button className="btn btn-primary" onClick={handleClone} disabled={cloneLoading}>
              {cloneLoading ? 'Cloning…' : 'Clone'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GitModal;
