/**
 * Detalle de un proyecto (Alinea Fase 2 #2): board list-first premium.
 * Instancia pipeline, transiciona tareas (la cascada de handoffs ocurre en el
 * Core), agrupa por estado, muestra el registro de handoffs. Arco + UnoCSS.
 */
import { ipcBridge } from '@/common';
import type { TPipelineTemplate, TProject, TTask, TTaskAction, TTaskHandoff, TTaskStatus } from '@/common/types/project';
import { Button, Dropdown, Empty, Menu, Message, Spin } from '@arco-design/web-react';
import { IconCheck, IconClose, IconRobot, IconThunderbolt, IconUser } from '@arco-design/web-react/icon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  projectId: string;
  onChanged?: () => void;
}

const STATUS_LABEL: Record<TTaskStatus, string> = {
  in_progress: 'En curso',
  in_review: 'En revisión',
  todo: 'Por hacer',
  blocked: 'Bloqueada',
  rejected: 'Rechazada',
  done: 'Hecho',
};

const GROUP_ORDER: TTaskStatus[] = ['in_progress', 'in_review', 'todo', 'blocked', 'rejected', 'done'];

const ARTIFACT_LABEL: Record<string, string> = {
  bom: 'BOM',
  alcances_obra: 'Alcances',
  doc: 'Doc',
};

/** Dot de estado (color encode + reposo). */
const StatusDot: React.FC<{ status: TTaskStatus }> = ({ status }) => {
  const base = 'size-11px rounded-full flex-none';
  if (status === 'todo') return <span className={`${base} border-[1.6px] border-border-2`} />;
  if (status === 'blocked') return <span className={`${base} bg-fill-3`} />;
  if (status === 'in_progress') return <span className={`${base} bg-warning`} />;
  if (status === 'in_review') return <span className={`${base} bg-primary`} />;
  if (status === 'done') return <span className={`${base} bg-success`} />;
  return <span className={`${base} bg-danger`} />;
};

/** Avatar del responsable: agente (acento) vs humano (neutro). */
const Assignee: React.FC<{ kind: TTask['assignee_kind'] }> = ({ kind }) => {
  if (kind === 'agent') {
    return (
      <span className='size-22px rounded-full bg-primary-light-1 text-primary flex items-center justify-center flex-none' title='OpenClaw'>
        <IconRobot fontSize={13} />
      </span>
    );
  }
  return (
    <span className='size-22px rounded-full bg-fill-2 text-t-tertiary flex items-center justify-center flex-none' title='Humano'>
      <IconUser fontSize={13} />
    </span>
  );
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
    setHandoffs(flat.slice(0, 6));
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

  const groups = useMemo(
    () => GROUP_ORDER.map((status) => ({ status, items: tasks.filter((task) => task.status === status) })).filter((g) => g.items.length > 0),
    [tasks]
  );
  const doneCount = useMemo(() => tasks.filter((task) => task.status === 'done').length, [tasks]);
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className='h-full flex items-center justify-center'>
        <Spin />
      </div>
    );
  }

  return (
    <div className='h-full flex flex-col bg-bg-base'>
      <header className='flex items-start gap-16px px-24px pt-18px pb-14px'>
        <div className='min-w-0 flex-1'>
          <div className='text-16px font-500 text-t-primary tracking-tight truncate'>{project?.name}</div>
          <div className='text-12px text-t-tertiary mt-3px flex items-center gap-8px'>
            {tasks.length === 0 ? (
              <span>{t('projects.noPipeline')}</span>
            ) : (
              <>
                <span>{t('projects.taskCount', { count: tasks.length })}</span>
                <span className='text-border-2'>·</span>
                <span className='text-primary'>{progress}%</span>
              </>
            )}
          </div>
          {tasks.length > 0 && (
            <div className='h-3px w-150px bg-fill-2 rounded-full mt-8px overflow-hidden'>
              <div className='h-full bg-primary rounded-full transition-[width] duration-300' style={{ width: `${progress}%` }} />
            </div>
          )}
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

      <div className='flex-1 overflow-y-auto px-16px pb-24px'>
        {tasks.length === 0 ? (
          <Empty description={t('projects.pipelineHint')} className='py-60px' />
        ) : (
          groups.map((group) => (
            <div key={group.status} className='mb-2px'>
              <div className='flex items-center gap-8px px-10px pt-14px pb-4px'>
                <span className='text-11px tracking-wide uppercase text-t-secondary font-500'>{STATUS_LABEL[group.status]}</span>
                <span className='text-11px text-t-tertiary'>{group.items.length}</span>
              </div>
              {group.items.map((task) => (
                <TaskRow key={task.id} task={task} busy={working === task.id} onAction={transition} t={t} />
              ))}
            </div>
          ))
        )}
      </div>

      {handoffs.length > 0 && (
        <div className='border-t border-border-1 px-24px py-12px'>
          <div className='text-11px tracking-wide uppercase text-t-tertiary font-500 mb-6px'>{t('projects.handoffLog')}</div>
          <div className='flex flex-col gap-3px'>
            {handoffs.map((h) => (
              <div key={h.id} className='text-12px text-t-secondary flex items-center gap-7px'>
                <span className={`size-5px rounded-full flex-none ${h.actor === 'system' ? 'bg-primary' : 'bg-fill-3'}`} />
                <span className='text-t-tertiary'>{h.actor === 'system' ? 'sistema' : h.actor === 'openclaw' ? 'OpenClaw' : 'tú'}</span>
                <span>{h.from_status ? `${STATUS_LABEL[h.from_status as TTaskStatus] ?? h.from_status} → ` : ''}{STATUS_LABEL[h.to_status as TTaskStatus] ?? h.to_status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Fila de tarea list-first: dot · título · artefacto · agente/humano · acción (al hover). */
const TaskRow: React.FC<{
  task: TTask;
  busy: boolean;
  onAction: (id: string, action: TTaskAction) => void;
  t: (k: string) => string;
}> = ({ task, busy, onAction, t }) => {
  const isDone = task.status === 'done';
  const running = task.status === 'in_progress' && task.assignee_kind === 'agent';
  return (
    <div className='group grid grid-cols-[14px_1fr_auto_auto_auto] items-center gap-12px h-38px px-10px rounded-6px cursor-default transition-colors duration-100 hover:bg-bg-hover'>
      <StatusDot status={task.status} />
      <span className={`text-14px truncate ${isDone ? 'text-t-tertiary line-through' : 'text-t-primary'}`}>{task.title}</span>
      {task.produces_artifact ? (
        <span className='text-11px text-t-secondary px-7px py-1px rounded-5px bg-fill-2 flex-none'>{ARTIFACT_LABEL[task.produces_artifact] ?? task.produces_artifact}</span>
      ) : (
        <span />
      )}
      {running ? (
        <span className='inline-flex items-center gap-5px text-11px text-primary flex-none'>
          <span className='size-6px rounded-full bg-primary animate-[pulse_1.3s_ease-in-out_infinite]' />
          ejecutando
        </span>
      ) : (
        <Assignee kind={task.assignee_kind} />
      )}
      <span className='flex-none min-w-92px flex justify-end'>{busy ? <Spin size={14} /> : <RowAction task={task} onAction={onAction} t={t} />}</span>
    </div>
  );
};

/** Acción contextual (revelada al hover). Las de revisión siempre visibles. */
const RowAction: React.FC<{
  task: TTask;
  onAction: (id: string, action: TTaskAction) => void;
  t: (k: string) => string;
}> = ({ task, onAction, t }) => {
  const reveal = 'opacity-0 group-hover:opacity-100 transition-opacity duration-100';
  switch (task.status) {
    case 'todo':
      return (
        <span className={reveal}>
          <Button size='mini' type='outline' icon={task.assignee_kind === 'agent' ? <IconRobot /> : undefined} onClick={() => onAction(task.id, 'start')}>
            {task.assignee_kind === 'agent' ? t('projects.actions.runAgent') : t('projects.actions.start')}
          </Button>
        </span>
      );
    case 'in_progress':
      return (
        <span className={reveal}>
          <Button size='mini' type='outline' onClick={() => onAction(task.id, 'submit')}>
            {t('projects.actions.submit')}
          </Button>
        </span>
      );
    case 'in_review':
      return (
        <span className='inline-flex gap-6px'>
          <Button size='mini' type='primary' icon={<IconCheck />} onClick={() => onAction(task.id, 'approve')}>
            {t('projects.actions.approve')}
          </Button>
          <Button size='mini' type='outline' status='danger' icon={<IconClose />} onClick={() => onAction(task.id, 'reject')} />
        </span>
      );
    case 'rejected':
      return (
        <span className={reveal}>
          <Button size='mini' type='outline' onClick={() => onAction(task.id, 'reopen')}>
            {t('projects.actions.reopen')}
          </Button>
        </span>
      );
    case 'blocked':
      return <span className='text-11px text-t-tertiary'>{t('projects.actions.waiting')}</span>;
    default:
      return <span />;
  }
};

export default ProjectDetail;
