/**
 * Detalle de un proyecto (Alinea Fase 2 #2): board list-first de tareas.
 * Instancia pipeline, transiciona tareas (la cascada de handoffs ocurre en el
 * Core), muestra artefactos y el registro de handoffs. Arco + UnoCSS.
 */
import { ipcBridge } from '@/common';
import type { TPipelineTemplate, TProject, TTask, TTaskAction, TTaskHandoff, TTaskStatus } from '@/common/types/project';
import { Button, Dropdown, Empty, Menu, Message, Spin, Tag } from '@arco-design/web-react';
import { IconRobot, IconThunderbolt, IconUser } from '@arco-design/web-react/icon';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  projectId: string;
  onChanged?: () => void;
}

const STATUS_META: Record<TTaskStatus, { color: string; label: string }> = {
  todo: { color: 'gray', label: 'Por hacer' },
  blocked: { color: 'orange', label: 'Bloqueada' },
  in_progress: { color: 'arcoblue', label: 'En progreso' },
  in_review: { color: 'purple', label: 'En revisión' },
  done: { color: 'green', label: 'Hecho' },
  rejected: { color: 'red', label: 'Rechazada' },
};

const ARTIFACT_LABEL: Record<string, string> = {
  bom: 'BOM',
  alcances_obra: 'Alcances de obra',
  doc: 'Documento',
};

const ProjectDetail: React.FC<Props> = ({ projectId, onChanged }) => {
  const { t } = useTranslation();
  const [project, setProject] = useState<TProject | null>(null);
  const [tasks, setTasks] = useState<TTask[]>([]);
  const [templates, setTemplates] = useState<TPipelineTemplate[]>([]);
  const [handoffs, setHandoffs] = useState<TTaskHandoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const list = await ipcBridge.projects.tasks.invoke({ id: projectId });
    setTasks((list ?? []).slice().sort((a: TTask, b: TTask) => a.order_index - b.order_index));
  }, [projectId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, , tpls] = await Promise.all([
        ipcBridge.projects.get.invoke({ id: projectId }),
        loadTasks(),
        ipcBridge.projects.templates.invoke(undefined),
      ]);
      setProject(p ?? null);
      setTemplates(tpls ?? []);
    } catch (e) {
      Message.error(t('projects.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [projectId, loadTasks, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshHandoffs = useCallback(async () => {
    const all = await Promise.all(tasks.map((task) => ipcBridge.projects.taskHandoffs.invoke({ id: task.id })));
    const flat = all.flat().sort((a: TTaskHandoff, b: TTaskHandoff) => b.created_at - a.created_at);
    setHandoffs(flat.slice(0, 8));
  }, [tasks]);

  useEffect(() => {
    if (tasks.length) void refreshHandoffs();
  }, [tasks, refreshHandoffs]);

  const instantiate = useCallback(
    async (templateId: string) => {
      setWorking('pipeline');
      try {
        await ipcBridge.projects.instantiatePipeline.invoke({ id: projectId, template_id: templateId });
        await loadTasks();
        onChanged?.();
      } catch (e) {
        Message.error(t('projects.errors.pipeline'));
      } finally {
        setWorking(null);
      }
    },
    [projectId, loadTasks, onChanged, t]
  );

  const transition = useCallback(
    async (taskId: string, action: TTaskAction) => {
      setWorking(taskId);
      try {
        await ipcBridge.projects.transitionTask.invoke({ id: taskId, action });
        await loadTasks();
      } catch (e) {
        Message.error(t('projects.errors.transition'));
      } finally {
        setWorking(null);
      }
    },
    [loadTasks, t]
  );

  const depsDone = useCallback(
    (task: TTask) => {
      const deps = tasks.filter((x) => x.status !== 'done');
      return !deps.some((d) => d.order_index < task.order_index);
    },
    [tasks]
  );

  if (loading) {
    return (
      <div className='h-full flex items-center justify-center'>
        <Spin />
      </div>
    );
  }

  return (
    <div className='h-full flex flex-col'>
      <header className='flex items-center justify-between px-24px py-16px border-b border-border-2'>
        <div className='min-w-0'>
          <div className='text-18px font-500 text-t-primary truncate'>{project?.name}</div>
          <div className='text-13px text-t-secondary'>{tasks.length === 0 ? t('projects.noPipeline') : t('projects.taskCount', { count: tasks.length })}</div>
        </div>
        {tasks.length === 0 && templates.length > 0 && (
          <Dropdown
            droplist={
              <Menu onClickMenuItem={(key) => instantiate(key)}>
                {templates.map((tpl) => (
                  <Menu.Item key={tpl.id}>{tpl.name}</Menu.Item>
                ))}
              </Menu>
            }
          >
            <Button type='primary' icon={<IconThunderbolt />} loading={working === 'pipeline'}>
              {t('projects.generatePipeline')}
            </Button>
          </Dropdown>
        )}
      </header>

      <div className='flex-1 overflow-y-auto px-24px py-16px'>
        {tasks.length === 0 ? (
          <Empty description={t('projects.pipelineHint')} className='py-60px' />
        ) : (
          tasks.map((task) => (
            <div key={task.id} className={`flex items-center gap-12px px-14px py-11px mb-8px rounded-8px border border-border-2 bg-bg-1 ${task.status === 'blocked' ? 'opacity-60' : ''}`}>
              <span className='text-12px text-t-tertiary w-18px flex-none'>{task.order_index + 1}</span>
              <span className='flex-1 min-w-0 text-14px text-t-primary truncate'>{task.title}</span>
              {task.produces_artifact && (
                <Tag size='small' className='flex-none'>
                  {ARTIFACT_LABEL[task.produces_artifact] ?? task.produces_artifact}
                </Tag>
              )}
              <span className='flex-none text-12px text-t-secondary inline-flex items-center gap-4px'>
                {task.assignee_kind === 'agent' ? <IconRobot /> : <IconUser />}
                {task.assignee_kind === 'agent' ? 'OpenClaw' : 'humano'}
              </span>
              <Tag color={STATUS_META[task.status].color} size='small' className='flex-none'>
                {STATUS_META[task.status].label}
              </Tag>
              <span className='flex-none'>{renderActions(task, working === task.id, depsDone(task), transition, t)}</span>
            </div>
          ))
        )}
      </div>

      {handoffs.length > 0 && (
        <div className='border-t border-border-2 px-24px py-12px max-h-160px overflow-y-auto'>
          <div className='text-13px font-500 text-t-primary mb-6px'>{t('projects.handoffLog')}</div>
          {handoffs.map((h) => (
            <div key={h.id} className='text-12px text-t-secondary py-2px'>
              {h.actor} · {h.from_status ? `${h.from_status} → ` : ''}
              {h.to_status} · {h.trigger_kind}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function renderActions(
  task: TTask,
  busy: boolean,
  depsDone: boolean,
  transition: (id: string, action: TTaskAction) => void,
  t: (k: string) => string
): React.ReactNode {
  if (busy) return <Spin size={14} />;
  switch (task.status) {
    case 'todo':
      if (task.assignee_kind === 'agent') {
        return (
          <Button size='mini' type='outline' icon={<IconRobot />} onClick={() => transition(task.id, 'start')}>
            {t('projects.actions.runAgent')}
          </Button>
        );
      }
      return (
        <Button size='mini' onClick={() => transition(task.id, 'start')}>
          {t('projects.actions.start')}
        </Button>
      );
    case 'in_progress':
      return (
        <Button size='mini' onClick={() => transition(task.id, 'submit')}>
          {t('projects.actions.submit')}
        </Button>
      );
    case 'in_review':
      return (
        <span className='inline-flex gap-6px'>
          <Button size='mini' type='primary' onClick={() => transition(task.id, 'approve')}>
            {t('projects.actions.approve')}
          </Button>
          <Button size='mini' status='danger' onClick={() => transition(task.id, 'reject')}>
            {t('projects.actions.reject')}
          </Button>
        </span>
      );
    case 'rejected':
      return (
        <Button size='mini' onClick={() => transition(task.id, 'reopen')}>
          {t('projects.actions.reopen')}
        </Button>
      );
    case 'blocked':
      return <span className='text-12px text-t-tertiary'>{t('projects.actions.waiting')}</span>;
    default:
      return null;
  }
}

export default ProjectDetail;
