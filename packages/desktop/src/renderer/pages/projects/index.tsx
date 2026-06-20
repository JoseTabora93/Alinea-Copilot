/**
 * Página de Proyectos — lista (Alinea Fase 2 #2).
 * List-first premium: rail de proyectos a la izquierda, detalle a la derecha.
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
    <div className='flex h-full w-full'>
      <aside className='w-300px flex flex-col border-r border-border-2 bg-bg-1'>
        <div className='flex items-center justify-between px-16px py-14px'>
          <span className='text-16px font-500 text-t-primary'>{t('projects.title')}</span>
          <Button type='primary' size='small' icon={<IconPlus />} onClick={() => setCreating(true)}>
            {t('projects.new')}
          </Button>
        </div>
        <div className='px-16px pb-10px'>
          <Input allowClear prefix={<IconSearch />} placeholder={t('projects.search')} value={query} onChange={setQuery} />
        </div>
        <div className='flex-1 overflow-y-auto px-8px'>
          {loading ? (
            <div className='flex justify-center py-40px'>
              <Spin />
            </div>
          ) : filtered.length === 0 ? (
            <Empty icon={<IconFolderAdd className='text-32px' />} description={t('projects.empty')} className='py-40px' />
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className={`w-full text-left rounded-8px px-12px py-10px mb-4px transition-colors b-none cursor-pointer ${
                  p.id === id ? 'bg-bg-active' : 'bg-transparent hover:bg-bg-hover'
                }`}
              >
                <div className='text-14px text-t-primary truncate'>{p.name}</div>
                <div className='text-12px text-t-secondary mt-2px'>
                  {PROJECT_TYPE_LABEL[p.project_type] ?? p.project_type}
                  {p.status === 'archived' ? ` · ${t('projects.archived')}` : ''}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className='flex-1 min-w-0 overflow-hidden'>
        {id ? (
          <ProjectDetail projectId={id} onChanged={load} />
        ) : (
          <div className='h-full flex flex-col items-center justify-center text-t-tertiary'>
            <IconFolderAdd className='text-40px' />
            <div className='mt-8px text-14px'>{t('projects.pickOne')}</div>
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
      >
        <Input
          autoFocus
          placeholder={t('projects.namePlaceholder')}
          value={newName}
          onChange={setNewName}
          onPressEnter={create}
        />
      </Modal>
    </div>
  );
};

export default ProjectsIndex;
