/**
 * Página de Proyectos — rail premium list-first (Alinea Fase 2 #2).
 * Rail denso de proyectos a la izquierda, board del proyecto a la derecha.
 * Cableado a la API del Core vía ipcBridge.projects.
 */
import { ipcBridge } from '@/common';
import type { TProject } from '@/common/types/project';
import { Button, Empty, Input, Message, Modal, Spin } from '@arco-design/web-react';
import { IconFolderAdd, IconPlus, IconSearch } from '@arco-design/web-react/icon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ProjectDetail from './ProjectDetail';

const PROJECT_TYPE_LABEL: Record<string, string> = {
  preventa_mep: 'Preventa MEP',
  diseno_mep: 'Diseño MEP',
  generico: 'Genérico',
};

const ProjectsIndex: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [projects, setProjects] = useState<TProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ipcBridge.projects.list.invoke(undefined);
      setProjects(list ?? []);
    } catch (e) {
      Message.error(t('projects.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const project = await ipcBridge.projects.create.invoke({ name });
      setProjects((prev) => [project, ...prev]);
      setCreating(false);
      setNewName('');
      navigate(`/projects/${project.id}`);
    } catch (e) {
      Message.error(t('projects.errors.create'));
    }
  }, [newName, navigate, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  return (
    <div className='flex h-full w-full bg-bg-base'>
      <aside className='w-240px flex flex-col flex-none border-r border-border-1 bg-bg-1'>
        <div className='flex items-center justify-between px-14px pt-14px pb-2px'>
          <span className='text-13px font-500 text-t-primary'>{t('projects.title')}</span>
          <button
            className='appearance-none b-none bg-transparent size-24px flex items-center justify-center rounded-6px text-t-secondary hover:bg-bg-hover hover:text-t-primary transition-colors duration-100 cursor-pointer'
            aria-label={t('projects.new')}
            onClick={() => setCreating(true)}
          >
            <IconPlus />
          </button>
        </div>
        <div className='px-10px py-8px'>
          <Input allowClear size='small' prefix={<IconSearch />} placeholder={t('projects.search')} value={query} onChange={setQuery} />
        </div>
        <div className='flex-1 overflow-y-auto px-8px pb-8px'>
          {loading ? (
            <div className='flex justify-center py-40px'>
              <Spin />
            </div>
          ) : filtered.length === 0 ? (
            <Empty icon={<IconFolderAdd style={{ fontSize: 28 }} />} description={t('projects.empty')} className='py-40px' />
          ) : (
            filtered.map((p) => {
              const active = p.id === id;
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className={`appearance-none b-none cursor-pointer group w-full text-left flex items-center gap-9px px-8px h-32px rounded-8px mb-1px transition-colors duration-100 ${
                    active ? 'bg-fill-2 text-t-primary' : 'bg-transparent text-t-secondary hover:bg-bg-hover'
                  }`}
                >
                  <span className={`size-7px rotate-45 rounded-1px flex-none ${active ? 'bg-primary' : 'bg-fill-3 group-hover:bg-border-2'}`} />
                  <span className='flex-1 min-w-0 text-13px truncate'>{p.name}</span>
                  {p.status === 'archived' && <span className='text-10px text-t-tertiary flex-none'>{t('projects.archived')}</span>}
                </button>
              );
            })
          )}
          {!loading && (
            <button
              onClick={() => setCreating(true)}
              className='appearance-none b-none bg-transparent cursor-pointer w-full text-left flex items-center gap-9px px-8px h-32px rounded-8px mt-2px text-t-tertiary hover:bg-bg-hover hover:text-t-secondary transition-colors duration-100'
            >
              <IconPlus />
              <span className='text-13px'>{t('projects.new')}</span>
            </button>
          )}
        </div>
      </aside>

      <main className='flex-1 min-w-0 overflow-hidden'>
        {id ? (
          <ProjectDetail projectId={id} onChanged={load} />
        ) : (
          <div className='h-full flex flex-col items-center justify-center text-t-tertiary gap-10px'>
            <IconFolderAdd style={{ fontSize: 36 }} />
            <div className='text-14px'>{t('projects.pickOne')}</div>
          </div>
        )}
      </main>

      <Modal
        title={t('projects.new')}
        visible={creating}
        onOk={create}
        onCancel={() => setCreating(false)}
        okText={t('projects.create')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !newName.trim() }}
        autoFocus
        focusLock
      >
        <Input autoFocus placeholder={t('projects.namePlaceholder')} value={newName} onChange={setNewName} onPressEnter={create} />
      </Modal>
    </div>
  );
};

export default ProjectsIndex;
