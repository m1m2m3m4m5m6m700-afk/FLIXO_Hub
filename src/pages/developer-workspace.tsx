import { useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Download,
  FileCode2,
  FilePlus2,
  FolderOpen,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {
  createLocalProjectFile,
  downloadBlob,
  exportLocalProjectZip,
  LOCAL_PROJECT_LIMITS,
  readLocalProjectFiles,
  type LocalProjectFile,
} from '../lib/developer-platform/local-project-workspace';
import '../developer-workspace.css';

type Locale = 'ar' | 'en';

const COPY = {
  ar: {
    back: 'العودة إلى منصة البرمجة',
    eyebrow: 'WORKSPACE · LOCAL PROJECT',
    title: 'مساحة مشروعك داخل المتصفح.',
    lead: 'استورد مشروعًا محليًا، عدّل الملفات النصية، وأنشئ حزمة ZIP جديدة — دون رفع الملفات أو تخزينها في localStorage.',
    import: 'استيراد مجلد مشروع',
    export: 'تصدير ZIP',
    newFile: 'ملف جديد',
    select: 'اختر ملفًا',
    editor: 'المحرر',
    binary: 'هذا الملف ثنائي أو أكبر من حد التحرير، لذلك لا يتم فتح محتواه داخل المحرر.',
    empty: 'استورد مجلد المشروع للبدء.',
    path: 'مسار الملف',
    save: 'حفظ في الذاكرة',
    dirty: 'تعديلات غير محفوظة داخل الجلسة',
    files: 'ملفات',
    editable: 'قابلة للتحرير',
    boundary: 'حدود الخصوصية',
    boundaryText: 'كل محتوى المشروع يبقى في ذاكرة الصفحة حتى تضغط أنت على تصدير ZIP. لا يوجد رفع تلقائي.',
    createPrompt: 'اسم الملف الجديد، مثل src/hello.ts',
  },
  en: {
    back: 'Back to Developer Platform',
    eyebrow: 'WORKSPACE · LOCAL PROJECT',
    title: 'Your project workspace in the browser.',
    lead: 'Import a local project, edit text files, create new files, and export a new ZIP — without uploads or localStorage persistence.',
    import: 'Import project folder',
    export: 'Export ZIP',
    newFile: 'New file',
    select: 'Select a file',
    editor: 'Editor',
    binary: 'This file is binary or larger than the editor limit, so its contents are not opened in the editor.',
    empty: 'Import a project folder to begin.',
    path: 'File path',
    save: 'Keep changes in memory',
    dirty: 'Unsaved session changes',
    files: 'files',
    editable: 'editable',
    boundary: 'Privacy boundary',
    boundaryText: 'Project contents stay in page memory until you explicitly export a ZIP. There is no automatic upload.',
    createPrompt: 'New file path, e.g. src/hello.ts',
  },
} as const;

function baseName(path: string): string {
  return path.split('/').pop() || path;
}

export function DeveloperWorkspace({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LocalProjectFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  const selected = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? null,
    [files, selectedPath],
  );

  const onImport = async (incoming: FileList | null) => {
    if (!incoming?.length) return;
    try {
      const next = await readLocalProjectFiles(Array.from(incoming));
      setFiles(next);
      setSelectedPath(next.find((file) => file.editable)?.path ?? next[0]?.path ?? null);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'IMPORT_FAILED');
    }
  };

  const updateSelected = (text: string) => {
    if (!selectedPath) return;
    setFiles((current) => current.map((file) =>
      file.path === selectedPath
        ? { ...file, text, size: new Blob([text]).size, dirty: true }
        : file,
    ));
  };

  const newFile = () => {
    const path = window.prompt(copy.createPrompt);
    if (!path) return;
    try {
      const created = createLocalProjectFile(path);
      setFiles((current) => [...current, created].sort((a, b) => a.path.localeCompare(b.path)));
      setSelectedPath(created.path);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'INVALID_PROJECT_PATH');
    }
  };

  const exportZip = async () => {
    if (!files.length) return;
    const blob = await exportLocalProjectZip(files);
    downloadBlob(blob, 'flixo-project.zip');
    setStatus('');
  };

  const editableCount = files.filter((file) => file.editable).length;
  const dirtyCount = files.filter((file) => file.dirty).length;

  return (
    <main className="developer-workspace" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="developer-workspace-shell">
        <header className="developer-workspace-header">
          <div>
            <Link to={locale === 'ar' ? '/developer' : '/en/developer'} className="developer-workspace-back">← {copy.back}</Link>
            <p className="developer-workspace-eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p className="developer-workspace-lead">{copy.lead}</p>
          </div>
          <div className="developer-workspace-trust">
            <ShieldCheck size={20} />
            <span>{copy.boundary}</span>
            <small>{copy.boundaryText}</small>
          </div>
        </header>

        <section className="developer-workspace-toolbar" aria-label="Workspace controls">
          <button type="button" onClick={() => inputRef.current?.click()}><FolderOpen size={16} />{copy.import}</button>
          <button type="button" onClick={newFile}><FilePlus2 size={16} />{copy.newFile}</button>
          <button type="button" onClick={() => void exportZip()} disabled={!files.length}><Download size={16} />{copy.export}</button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            // Chromium/Edge expose directory selection through this non-standard attribute.
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            onChange={(event) => void onImport(event.target.files)}
          />
          <div className="developer-workspace-stats">
            <span>{files.length} {copy.files}</span>
            <span>{editableCount} {copy.editable}</span>
            {dirtyCount > 0 && <span className="is-dirty">{dirtyCount} {copy.dirty}</span>}
          </div>
        </section>

        {status && <p className="developer-workspace-status" role="alert">{status}</p>}

        {!files.length ? (
          <section className="developer-workspace-empty">
            <FileCode2 size={30} />
            <h2>{copy.empty}</h2>
            <p>{copy.lead}</p>
            <button type="button" onClick={() => inputRef.current?.click()}>{copy.import}</button>
          </section>
        ) : (
          <section className="developer-workspace-grid" aria-label="Project workspace">
            <aside className="developer-workspace-tree">
              <div className="developer-workspace-panel-title">{copy.select}</div>
              <div className="developer-workspace-file-list">
                {files.map((file) => (
                  <button
                    type="button"
                    key={file.path}
                    className={file.path === selectedPath ? 'is-selected' : ''}
                    onClick={() => setSelectedPath(file.path)}
                    title={file.path}
                  >
                    <FileCode2 size={15} aria-hidden="true" />
                    <span>{file.path}</span>
                    {file.dirty && <i aria-label={copy.dirty}>•</i>}
                  </button>
                ))}
              </div>
            </aside>

            <section className="developer-workspace-editor">
              <div className="developer-workspace-panel-title">
                <span>{selected ? selected.path : copy.select}</span>
                {selected?.dirty && <span className="developer-workspace-dirty-label">{copy.dirty}</span>}
              </div>
              {selected?.editable ? (
                <>
                  <textarea
                    aria-label={copy.editor}
                    value={selected.text ?? ''}
                    spellCheck={false}
                    onChange={(event) => updateSelected(event.target.value)}
                  />
                  <div className="developer-workspace-editor-footer">
                    <span>{copy.path}: {selected.path}</span>
                    <span>{selected.size.toLocaleString()} bytes</span>
                    <span><Save size={14} /> {copy.save}</span>
                  </div>
                </>
              ) : (
                <div className="developer-workspace-binary">
                  <FileCode2 size={28} />
                  <p>{copy.binary}</p>
                </div>
              )}
            </section>
          </section>
        )}

        <p className="developer-workspace-limit">
          {locale === 'ar'
            ? `حد تحرير الملف: ${Math.round(LOCAL_PROJECT_LIMITS.maxEditableBytes / 1024 / 1024)} MB · التخزين: في الذاكرة فقط · الشبكة: لا شيء`
            : `Editable file limit: ${Math.round(LOCAL_PROJECT_LIMITS.maxEditableBytes / 1024 / 1024)} MB · persistence: memory only · network: none`}
        </p>
      </div>
    </main>
  );
}
