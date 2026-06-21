/**
 * Detalle de un proyecto (Alinea Fase 2 #2): shell premium list-first.
 * Header (nombre + carpeta WorkDrive + tabs) · vistas Lista/Board/Docs/Archivos ·
 * panel Copiloto. Lista/Board con datos reales del Core; Docs/Archivos son
 * estados honestos hasta que exista su backend. Arco + UnoCSS.
 */
import { ipcBridge } from '@/common';
import type { TPipelineTemplate, TProject, TTask, TTaskAction, TTaskHandoff, TTaskStatus } from '@/common/types/project';
import { Button, Dropdown, Empty, Menu, Message, Spin } from '@arco-design/web-react';
import { IconCheck, IconClose, IconCommon, IconFile, IconFolder, IconList, IconMessage, IconRobot, IconThunderbolt, IconUser } from '@arco-design/web-react/icon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  projectId: string;
  onChanged?: () => void;
}
type Tab = 'list' | 'board' | 'docs' | 'files';

const STATUS_LABEL: Record<TTaskStatus, string> = {
  in_progress: 'En curso',
  in_review: 'En revisión',
  todo: 'Por hacer',
  blocked: 'Bloqueada',
  rejected: 'Rechazada',
  done: 'Hecho',
};
const GROUP_ORDER: TTaskStatus[] = ['in_progress', 'in_review', 'todo', 'blocked', 'rejected', 'done'];
const BOARD_COLS: { key: string; label: string; states: TTaskStatus[] }[] = [
  { key: 'backlog', label: 'Por hacer', states: ['todo', 'blocked'] },
  { key: 'prog', label: 'En curso', states: ['in_progress'] },
  { key: 'review', label: 'Revisión', states: ['in_review', 'rejected'] },
  { key: 'done', label: 'Hecho', states: ['done'] },
];
const ARTIFACT_LABEL: Record<string, string> = { bom: 'BOM', alcances_obra: 'Alcances', doc: 'Doc' };
/** Badge de estado estilo square-ui (fill suave + texto del mismo tono). */
const STATUS_BADGE: Record<TTaskStatus, string> = {
  todo: 'bg-fill-2 text-t-secondary',
  blocked: 'bg-fill-2 text-t-tertiary',
  in_progress: 'bg-warning-light-1 text-warning',
  in_review: 'bg-primary-light-1 text-primary',
  done: 'bg-success-light-1 text-success',
  rejected: 'bg-danger-light-1 text-danger',
};

const StatusDot: React.FC<{ status: TTaskStatus }> = ({ status }) => {
  const base = 'size-11px rounded-full flex-none';
  if (status === 'todo') return <span className={`${base} border-[1.6px] border-border-2`} />;
  if (status === 'blocked') return <span className={`${base} bg-fill-3`} />;
  if (status === 'in_progress') return <span className={`${base} bg-warning`} />;
  if (status === 'in_review') return <span className={`${base} bg-primary`} />;
  if (status === 'done') return <span className={`${base} bg-success`} />;
  return <span className={`${base} bg-danger`} />;
};

const Assignee: React.FC<{ kind: TTask['assignee_kind'] }> = ({ kind }) => (
  <span
    className={`size-22px rounded-full flex items-center justify-center flex-none ${kind === 'agent' ? 'bg-primary-light-1 text-primary' : 'bg-fill-2 text-t-tertiary'}`}
    title={kind === 'agent' ? 'OpenClaw' : 'Humano'}
  >
    {kind === 'agent' ? <IconRobot fontSize={13} /> : <IconUser fontSize={13} />}
  </span>
);

const ProjectDetail: React.FC<Props> = ({ projectId, onChanged }) => {
  const { t } = useTranslation();
  const [project, setProject] = useState<TProject | null>(null);
  const [tasks, setTasks] = useState<TTask[]>([]);
  const [templates, setTemplates] = useState<TPipelineTemplate[]>([]);
  const [handoffs, setHandoffs] = useState<TTaskHandoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('list');
  const [copiloto, setCopiloto] = useState(false);

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
    setHandoffs(flat.slice(0, 12));
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

  // Mapa padre → subtareas (jerarquía task/subtask).
  const childrenOf = useMemo(() => {
    const map = new Map<string, TTask[]>();
    for (const task of tasks) {
      if (task.parent_task_id) {
        const arr = map.get(task.parent_task_id) ?? [];
        arr.push(task);
        map.set(task.parent_task_id, arr);
      }
    }
    return map;
  }, [tasks]);
  const topTasks = useMemo(() => tasks.filter((task) => !task.parent_task_id), [tasks]);
  const groups = useMemo(
    () => GROUP_ORDER.map((status) => ({ status, items: topTasks.filter((task) => task.status === status) })).filter((g) => g.items.length > 0),
    [topTasks]
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

  const renderTask = (task: TTask, depth = 0) => (
    <React.Fragment key={task.id}>
      <TaskRow task={task} depth={depth} busy={working === task.id} onAction={transition} t={t} />
      {(childrenOf.get(task.id) ?? []).map((child) => renderTask(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className='h-full flex min-w-0'>
      <div className='flex-1 min-w-0 flex flex-col bg-bg-base'>
        {/* Header */}
        <header className='px-24px pt-16px'>
          <div className='flex items-start gap-16px'>
            <div className='min-w-0 flex-1'>
              <div className='text-17px font-500 text-t-primary tracking-tight truncate'>{project?.name}</div>
              <div className='text-12px text-t-tertiary mt-3px flex items-center gap-8px flex-wrap'>
                {tasks.length > 0 && (
                  <>
                    <span>{t('projects.taskCount', { count: tasks.length })}</span>
                    <span className='text-border-2'>·</span>
                    <span className='text-primary'>{progress}%</span>
                    <span className='text-border-2'>·</span>
                  </>
                )}
                <button
                  className='inline-flex items-center gap-5px px-7px py-1px rounded-5px border-[.5px] border-border-2 text-t-tertiary hover:text-t-secondary hover:border-border-1 transition-colors duration-100'
                  onClick={() => Message.info(t('projects.workdriveSoon'))}
                >
                  <IconFolder fontSize={12} />
                  {t('projects.linkWorkdrive')}
                </button>
              </div>
            </div>
            <div className='flex items-center gap-6px flex-none'>
              <Button size='small' type={copiloto ? 'primary' : 'default'} icon={<IconMessage />} onClick={() => setCopiloto((v) => !v)}>
                {t('projects.copiloto')}
              </Button>
              {tasks.length === 0 && templates.length > 0 && (
                <Dropdown droplist={<Menu onClickMenuItem={(key) => instantiate(key)}>{templates.map((tpl) => <Menu.Item key={tpl.id}>{tpl.name}</Menu.Item>)}</Menu>}>
                  <Button size='small' type='primary' icon={<IconThunderbolt />} loading={working === 'pipeline'}>
                    {t('projects.generatePipeline')}
                  </Button>
                </Dropdown>
              )}
            </div>
          </div>
          {/* Tabs */}
          <div className='flex gap-2px mt-12px -mb-px'>
            {([['list', t('projects.tabs.list'), <IconList key='i' />], ['board', t('projects.tabs.board'), <IconCommon key='i' />], ['docs', t('projects.tabs.docs'), <IconFile key='i' />], ['files', t('projects.tabs.files'), <IconFolder key='i' />]] as [Tab, string, React.ReactNode][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`text-13px px-10px py-7px rounded-t-6px transition-colors duration-100 ${tab === key ? 'text-t-primary font-500 shadow-[inset_0_-1.5px_0_var(--primary)]' : 'text-t-tertiary hover:text-t-secondary'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className='h-px bg-border-1 flex-none' />

        {/* Vistas */}
        <div className='flex-1 overflow-y-auto'>
          {tab === 'list' &&
            (tasks.length === 0 ? (
              <Empty description={t('projects.pipelineHint')} className='py-60px' />
            ) : (
              <div className='px-16px pb-24px'>
                {groups.map((group) => (
                  <div key={group.status} className='mb-2px'>
                    <div className='flex items-center gap-8px px-10px pt-14px pb-4px'>
                      <span className='text-11px tracking-wide uppercase text-t-secondary font-500'>{STATUS_LABEL[group.status]}</span>
                      <span className='text-11px text-t-tertiary'>{group.items.length}</span>
                    </div>
                    {group.items.map((task) => renderTask(task))}
                  </div>
                ))}
              </div>
            ))}

          {tab === 'board' &&
            (tasks.length === 0 ? (
              <Empty description={t('projects.pipelineHint')} className='py-60px' />
            ) : (
              <>
                <StatsRow tasks={tasks} t={t} />
                <div className='grid grid-cols-4 gap-14px px-18px py-16px'>
                  {BOARD_COLS.map((col) => {
                    const items = topTasks.filter((task) => col.states.includes(task.status));
                    return (
                      <div key={col.key}>
                        <div className='flex justify-between items-center px-2px pb-12px'>
                          <span className='text-12px font-500 text-t-primary'>{col.label}</span>
                          <span className='text-11px text-t-tertiary px-7px py-1px rounded-full bg-fill-2'>{items.length}</span>
                        </div>
                        {items.map((task) => (
                          <BoardCard key={task.id} task={task} t={t} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </>
            ))}

          {tab === 'docs' && (
            <Placeholder icon={<IconFile fontSize={30} />} title={t('projects.docsTitle')} hint={t('projects.docsSoon')} />
          )}
          {tab === 'files' && (
            <Placeholder icon={<IconFolder fontSize={30} />} title={t('projects.filesTitle')} hint={t('projects.filesSoon')} />
          )}
        </div>
      </div>

      {copiloto && <Copiloto projectName={project?.name ?? ''} handoffs={handoffs} onClose={() => setCopiloto(false)} t={t} />}
    </div>
  );
};

const Placeholder: React.FC<{ icon: React.ReactNode; title: string; hint: string }> = ({ icon, title, hint }) => (
  <div className='h-full flex flex-col items-center justify-center text-t-tertiary gap-8px py-60px'>
    <span className='text-t-tertiary'>{icon}</span>
    <div className='text-14px text-t-secondary'>{title}</div>
    <div className='text-12px text-t-tertiary'>{hint}</div>
  </div>
);

const StatsRow: React.FC<{ tasks: TTask[]; t: (k: string) => string }> = ({ tasks, t }) => {
  const count = (s: TTaskStatus) => tasks.filter((x) => x.status === s).length;
  const cards = [
    { label: t('projects.stats.total'), value: tasks.length, accent: 'text-t-primary' },
    { label: STATUS_LABEL.in_progress, value: count('in_progress'), accent: 'text-warning' },
    { label: STATUS_LABEL.in_review, value: count('in_review'), accent: 'text-primary' },
    { label: STATUS_LABEL.done, value: count('done'), accent: 'text-success' },
  ];
  return (
    <div className='grid grid-cols-4 gap-14px px-18px pt-16px'>
      {cards.map((c) => (
        <div key={c.label} className='rounded-2xl border-[.5px] border-border-2 bg-bg-1 px-16px py-14px'>
          <div className='text-12px text-t-tertiary mb-6px'>{c.label}</div>
          <div className={`text-26px font-500 leading-none ${c.accent}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
};

const BoardCard: React.FC<{ task: TTask; t: (k: string) => string }> = ({ task, t }) => {
  const running = task.status === 'in_progress' && task.assignee_kind === 'agent';
  return (
    <div className='rounded-2xl border-[.5px] border-border-2 bg-bg-1 p-14px mb-12px cursor-default transition-all duration-150 hover:border-border-1 hover:-translate-y-px'>
      <div className='flex items-center justify-between mb-10px'>
        <span className={`text-10px font-500 px-8px py-2px rounded-full ${STATUS_BADGE[task.status]}`}>{STATUS_LABEL[task.status]}</span>
        {task.assignee_kind === 'agent' && (
          <span className='inline-flex items-center gap-4px text-10px text-primary'>
            <IconRobot fontSize={12} />
            OpenClaw
          </span>
        )}
      </div>
      <h3 className={`text-13px font-500 leading-snug mb-12px ${task.status === 'done' ? 'text-t-tertiary line-through' : 'text-t-primary'}`}>{task.title}</h3>
      <div className='h-px bg-border-1 opacity-60 mb-12px' />
      <div className='flex items-center justify-between'>
        <span className='inline-flex items-center gap-5px text-11px text-t-tertiary'>
          {task.produces_artifact ? (
            <>
              <IconFile fontSize={14} />
              {ARTIFACT_LABEL[task.produces_artifact] ?? task.produces_artifact}
            </>
          ) : (
            <>
              <IconList fontSize={14} />
              {task.requires_human_review ? t('projects.gateReview') : t('projects.gateAuto')}
            </>
          )}
        </span>
        {running ? (
          <span className='inline-flex items-center gap-5px text-11px text-primary'>
            <span className='size-6px rounded-full bg-primary animate-[pulse_1.3s_ease-in-out_infinite]' />
            ejecutando
          </span>
        ) : (
          <Assignee kind={task.assignee_kind} />
        )}
      </div>
    </div>
  );
};

const Copiloto: React.FC<{ projectName: string; handoffs: TTaskHandoff[]; onClose: () => void; t: (k: string) => string }> = ({ projectName, handoffs, onClose, t }) => (
  <aside className='w-320px flex-none flex flex-col border-l border-border-1 bg-bg-1'>
    <div className='flex items-center gap-8px px-14px h-44px border-b border-border-1 text-13px font-500 text-t-primary'>
      <IconMessage />
      <span className='truncate'>Copiloto · {projectName}</span>
      <button className='ml-auto text-t-tertiary hover:text-t-secondary' onClick={onClose} aria-label='cerrar'>
        <IconClose />
      </button>
    </div>
    <div className='flex-1 overflow-y-auto px-14px py-12px'>
      <div className='text-11px uppercase tracking-wide text-t-tertiary font-500 mb-8px'>{t('projects.activity')}</div>
      {handoffs.length === 0 ? (
        <div className='text-12px text-t-tertiary'>{t('projects.noActivity')}</div>
      ) : (
        <div className='flex flex-col gap-9px'>
          {handoffs.map((h) => (
            <div key={h.id} className='text-12px text-t-secondary flex items-start gap-7px'>
              <span className={`size-6px rounded-full flex-none mt-5px ${h.actor === 'system' ? 'bg-primary' : 'bg-fill-3'}`} />
              <span>
                <span className='text-t-tertiary'>{h.actor === 'system' ? 'sistema' : h.actor === 'openclaw' ? 'OpenClaw' : 'tú'}</span>{' '}
                {h.from_status ? `${STATUS_LABEL[h.from_status as TTaskStatus] ?? h.from_status} → ` : ''}
                {STATUS_LABEL[h.to_status as TTaskStatus] ?? h.to_status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
    <div className='border-t border-border-1 p-10px'>
      <div className='h-34px flex items-center px-10px rounded-6px border-[.5px] border-border-2 text-12px text-t-tertiary'>{t('projects.copilotoSoon')}</div>
    </div>
  </aside>
);

const TaskRow: React.FC<{ task: TTask; depth?: number; busy: boolean; onAction: (id: string, action: TTaskAction) => void; t: (k: string) => string }> = ({ task, depth = 0, busy, onAction, t }) => {
  const isDone = task.status === 'done';
  const running = task.status === 'in_progress' && task.assignee_kind === 'agent';
  return (
    <div className='group grid grid-cols-[14px_1fr_auto_auto_auto] items-center gap-12px h-38px px-10px rounded-6px cursor-default transition-colors duration-100 hover:bg-bg-hover' style={depth ? { paddingLeft: 10 + depth * 22 } : undefined}>
      <StatusDot status={task.status} />
      <span className={`text-14px truncate ${isDone ? 'text-t-tertiary line-through' : 'text-t-primary'}`}>{task.title}</span>
      {task.produces_artifact ? <span className='text-11px text-t-secondary px-7px py-1px rounded-5px bg-fill-2 flex-none'>{ARTIFACT_LABEL[task.produces_artifact] ?? task.produces_artifact}</span> : <span />}
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

const RowAction: React.FC<{ task: TTask; onAction: (id: string, action: TTaskAction) => void; t: (k: string) => string }> = ({ task, onAction, t }) => {
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
